import { describe, expect, it } from 'vitest';
import {
  createSupabaseRepository,
  OfferReportRow,
  reportFromRow,
  TrackedOfferRow,
  trackedOfferChangesToRow,
} from '@/lib/db/supabase-repository';
import { StoreError } from '@/lib/db/repository';
import { createFakeSupabase, op } from '../support/fake-supabase';

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
