import { describe, expect, it, vi } from 'vitest';
import {
  createSupabaseRepository,
  OfferReportRow,
  reportFromRow,
  TrackedOfferRow,
  trackedOfferChangesToRow,
} from '@/lib/db/supabase-repository';
import { StoreError } from '@/lib/db/repository';
import { createFakeSupabase, op, RecordedQuery } from '../support/fake-supabase';

const reportRow: OfferReportRow = {
  id: 'r1',
  company_slug: 'acme',
  company_name: 'Acme',
  status: 'joining_delayed',
  description: null,
  delay_weeks: '4.5',
  role: null,
  graduation_year: 2026,
  reported_at: '2026-09-01',
  source_type: 'community',
  is_demo: false,
};

const trackedRow: TrackedOfferRow = {
  id: 't1',
  company_slug: 'acme',
  company_name: 'Acme',
  role: 'Engineer',
  offer_date: null,
  expected_joining_date: '2026-11-01',
  last_communication_date: null,
  current_status: 'offer_received',
  notes: null,
  is_demo: false,
};

describe('row mapping', () => {
  it('maps null columns to absent fields and numeric strings to numbers', () => {
    const report = reportFromRow(reportRow);
    expect(report).toEqual({
      id: 'r1',
      companySlug: 'acme',
      companyName: 'Acme',
      status: 'joining_delayed',
      delayWeeks: 4.5,
      graduationYear: 2026,
      reportedAt: '2026-09-01',
      sourceType: 'community',
      isDemo: false,
    });
    expect(JSON.parse(JSON.stringify(report))).not.toHaveProperty('description');
  });

  it('only includes changed columns in an update', () => {
    expect(trackedOfferChangesToRow({ notes: 'hi', companyName: 'X Co', companySlug: 'x-co' })).toEqual({
      notes: 'hi',
      company_name: 'X Co',
      company_slug: 'x-co',
    });
  });
});

describe('createSupabaseRepository', () => {
  it('lists reports newest first and pages past 1000 rows', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ ...reportRow, id: `r${i}` }));
    const { client, queries } = createFakeSupabase((q) => {
      const [from] = op(q, 'range')!.args as [number, number];
      return { data: from === 0 ? full : [reportRow], error: null };
    });

    const reports = await createSupabaseRepository(client).listReports();

    expect(reports).toHaveLength(1001);
    expect(queries).toHaveLength(2);
    expect(queries[0].table).toBe('offer_reports');
    expect(op(queries[0], 'order')!.args).toEqual(['reported_at', { ascending: false }]);
    expect(op(queries[1], 'range')!.args).toEqual([1000, 1999]);
  });

  it('filters by company slug', async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: [reportRow], error: null }));
    await createSupabaseRepository(client).listReportsByCompany('acme');
    expect(op(queries[0], 'eq')!.args).toEqual(['company_slug', 'acme']);
  });

  it('inserts reports with snake_case columns and returns the stored row', async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: { ...reportRow, id: 'db-id' }, error: null }));
    const created = await createSupabaseRepository(client).insertReport({
      companySlug: 'acme',
      companyName: 'Acme',
      status: 'joining_delayed',
      delayWeeks: 4.5,
      graduationYear: 2026,
      reportedAt: '2026-09-01',
      sourceType: 'community',
      isDemo: false,
    });

    expect(created.id).toBe('db-id');
    expect(op(queries[0], 'insert')!.args[0]).toEqual({
      company_slug: 'acme',
      company_name: 'Acme',
      status: 'joining_delayed',
      description: null,
      delay_weeks: 4.5,
      role: null,
      graduation_year: 2026,
      reported_at: '2026-09-01',
      source_type: 'community',
      is_demo: false,
    });
  });

  it('returns null when updating a tracked offer that does not exist', async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: null, error: null }));
    const result = await createSupabaseRepository(client).updateTrackedOffer('missing', { notes: 'x' });
    expect(result).toBeNull();
    expect(op(queries[0], 'eq')!.args).toEqual(['id', 'missing']);
    expect(op(queries[0], 'update')!.args[0]).toMatchObject({ notes: 'x', updated_at: expect.any(String) });
  });

  it('maps an updated tracked offer back to the API shape', async () => {
    const { client } = createFakeSupabase(() => ({ data: { ...trackedRow, notes: 'x' }, error: null }));
    const result = await createSupabaseRepository(client).updateTrackedOffer('t1', { notes: 'x' });
    expect(result).toMatchObject({ id: 't1', notes: 'x', alerts: [], expectedJoiningDate: '2026-11-01' });
  });

  const newReport = {
    companySlug: 'acme',
    companyName: 'Acme',
    status: 'joining_delayed' as const,
    reportedAt: '2026-09-01',
    sourceType: 'community' as const,
    isDemo: false,
  };
  const allOps = (q: RecordedQuery, name: string) => q.ops.filter((o) => o.name === name).map((o) => o.args);

  it('stores the submitter hash when the column exists, checking for it only once', async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: { ...reportRow, id: 'db-id' }, error: null }));
    const repo = createSupabaseRepository(client);
    await repo.insertReport(newReport, { submitterHash: 'abc123' });
    await repo.insertReport(newReport, { submitterHash: 'abc123' });

    expect(queries.map((q) => (op(q, 'insert') ? 'insert' : op(q, 'select')!.args[0]))).toEqual(['submitter_hash', 'insert', 'insert']);
    expect(op(queries[1], 'insert')!.args[0]).toMatchObject({ submitter_hash: 'abc123', is_demo: false });
  });

  it('keeps working without the submitter_hash migration: no hash stored, limits reported as unavailable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client, queries } = createFakeSupabase((q) =>
      op(q, 'select')?.args[0] === 'submitter_hash'
        ? { data: null, error: { message: 'column offer_reports.submitter_hash does not exist' } }
        : { data: { ...reportRow, id: 'db-id' }, error: null }
    );
    const repo = createSupabaseRepository(client);

    await repo.insertReport(newReport, { submitterHash: 'abc123' });
    expect(op(queries[1], 'insert')!.args[0]).not.toHaveProperty('submitter_hash');
    expect(await repo.listSubmissionsBySubmitter('abc123', '2026-10-10T00:00:00.000Z')).toBeNull();
    expect(queries.filter((q) => op(q, 'select')?.args[0] === 'submitter_hash')).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("lists a submitter's reports since a given time", async () => {
    const { client, queries } = createFakeSupabase((q) =>
      op(q, 'eq') ? { data: [{ company_slug: 'acme', status: 'offer_revoked', created_at: '2026-10-10T01:00:00Z' }], error: null } : { data: [], error: null }
    );
    const result = await createSupabaseRepository(client).listSubmissionsBySubmitter('abc123', '2026-10-10T00:00:00.000Z');
    expect(result).toEqual([{ companySlug: 'acme', status: 'offer_revoked', createdAt: '2026-10-10T01:00:00Z' }]);
    expect(op(queries[1], 'eq')!.args).toEqual(['submitter_hash', 'abc123']);
    expect(op(queries[1], 'gte')!.args).toEqual(['created_at', '2026-10-10T00:00:00.000Z']);
  });

  it('lists only demo offers plus the requested non-demo ids for a viewer', async () => {
    const { client, queries } = createFakeSupabase((q) =>
      op(q, 'in') ? { data: [{ ...trackedRow, id: 'mine' }], error: null } : { data: [{ ...trackedRow, id: 'demo', is_demo: true }], error: null }
    );
    const offers = await createSupabaseRepository(client).listTrackedOffersForViewer(['mine']);
    expect(offers.map((o) => o.id)).toEqual(['demo', 'mine']);
    // queries[0] is the one-off user_id column probe; demo offers and the viewer's own ids follow it.
    expect(op(queries[0], 'select')!.args[0]).toBe('user_id');
    expect(allOps(queries[1], 'eq')).toEqual([['is_demo', true]]);
    expect(op(queries[2], 'in')!.args).toEqual(['id', ['mine']]);
    expect(allOps(queries[2], 'eq')).toEqual([['is_demo', false]]);
    // Anonymous viewers can never reach account-owned offers, even holding an id.
    expect(op(queries[2], 'is')!.args).toEqual(['user_id', null]);

    const fresh = createFakeSupabase(() => ({ data: [], error: null }));
    await createSupabaseRepository(fresh.client).listTrackedOffersForViewer([]);
    expect(fresh.queries).toHaveLength(2); // column probe + demo offers
  });

  it('never updates demo tracked offers', async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: null, error: null }));
    await createSupabaseRepository(client).updateTrackedOffer('demo-tracked-1', { notes: 'x' });
    expect(allOps(queries[0], 'eq')).toEqual([
      ['id', 'demo-tracked-1'],
      ['is_demo', false],
    ]);
  });

  it('throws StoreError instead of reporting success when a query fails', async () => {
    const { client } = createFakeSupabase(() => ({ data: null, error: { message: 'permission denied' } }));
    const repo = createSupabaseRepository(client);

    await expect(repo.listReports()).rejects.toBeInstanceOf(StoreError);
    await expect(repo.listTrackedOffers()).rejects.toMatchObject({ kind: 'query_failed' });
    await expect(
      repo.insertTrackedOffer({ companySlug: 'a', companyName: 'Acme', currentStatus: 'offer_received' })
    ).rejects.toThrow(/permission denied/);
  });
});
