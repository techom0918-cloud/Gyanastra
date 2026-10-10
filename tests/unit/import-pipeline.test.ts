import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  commitImport,
  computeBatchId,
  ExistingReport,
  ImportError,
  importRow,
  parseInput,
  planImport,
  PlanOptions,
  prepareImport,
} from '@/lib/import/importer';
import { TEST_TAG } from '@/lib/import/validate';
import { createFakeSupabase, op, RecordedQuery } from '../support/fake-supabase';

const TODAY = '2026-10-10';
const OPTIONS: PlanOptions = { today: TODAY, batchId: 'import-test-batch', testFixtures: true };
const fixtureCsv = readFileSync(path.resolve(__dirname, '../fixtures/import/tagged-fixtures.csv'), 'utf8');

const record = (overrides: object = {}) => ({
  companyName: 'Fixture Alpha Ltd',
  status: 'joining_delayed',
  reportedAt: '2026-09-01',
  evidenceType: 'news_report',
  sourceUrl: 'https://example.org/fixture/alpha',
  collectedAt: '2026-09-05',
  description: `${TEST_TAG} fixture`,
  ...overrides,
});

const existing = (overrides: Partial<ExistingReport>): ExistingReport => ({
  id: 'existing-1',
  company_slug: 'fixture-alpha-ltd',
  status: 'joining_delayed',
  role: null,
  graduation_year: null,
  reported_at: '2026-09-01',
  import_key: null,
  is_demo: false,
  ...overrides,
});

const WRITE_OPS = ['insert', 'upsert', 'update', 'delete'];
const writes = (queries: RecordedQuery[]) => queries.flatMap((q) => q.ops.filter((o) => WRITE_OPS.includes(o.name)));

describe('planImport with the tagged CSV fixture', () => {
  const plan = planImport(parseInput(fixtureCsv, 'csv'), [], OPTIONS);

  it('accepts valid rows, rejects invalid ones and collapses in-file duplicates', () => {
    expect(plan.totalRecords).toBe(4);
    expect(plan.toInsert.map((r) => r.row)).toEqual([1, 2]);
    expect(plan.duplicateInFile).toEqual([{ row: 3, firstRow: 1 }]);
    expect(plan.rejected).toEqual([{ row: 4, errors: [expect.objectContaining({ field: 'reportedAt' })] }]);
  });

  it('keeps quoted CSV text intact and derives provenance', () => {
    expect(plan.toInsert[1]).toMatchObject({
      description: `${TEST_TAG} Fixture, with "quotes" and a comma`,
      sourceReference: 'Fixture notice ref FX/1',
      verificationStatus: 'verified',
      sourceType: 'verified',
    });
  });

  it('refuses the same fixture outside test-fixture mode', () => {
    const real = planImport(parseInput(fixtureCsv, 'csv'), [], { today: TODAY, batchId: 'b' });
    expect(real.toInsert).toEqual([]);
    expect(real.rejected).toHaveLength(4);
  });
});

describe('planImport duplicate handling', () => {
  it('skips records whose import_key is already in the database (safe re-run)', () => {
    const first = planImport([record()], [], OPTIONS);
    const key = first.toInsert[0].importKey;
    const rerun = planImport([record()], [existing({ id: 'imported-1', import_key: key })], OPTIONS);
    expect(rerun.toInsert).toEqual([]);
    expect(rerun.alreadyImported).toEqual([{ row: 1, existingId: 'imported-1' }]);
  });

  it('holds near-duplicates of community reports for review instead of inserting them', () => {
    const plan = planImport([record()], [existing({ id: 'community-1', reported_at: '2026-08-25' })], OPTIONS);
    expect(plan.toInsert).toEqual([]);
    expect(plan.possibleDuplicates).toEqual([
      expect.objectContaining({ row: 1, included: false, matches: [expect.objectContaining({ existingId: 'community-1', provenance: 'community' })] }),
    ]);
  });

  it('holds the same outcome cited from two different sources in one file', () => {
    const plan = planImport([record(), record({ sourceUrl: 'https://example.org/other-outlet' })], [], OPTIONS);
    expect(plan.toInsert.map((r) => r.row)).toEqual([1]);
    expect(plan.possibleDuplicates[0]).toMatchObject({ row: 2, matches: [{ fileRow: 1, provenance: 'this-file' }] });
  });

  it('includes held rows only when explicitly allowed', () => {
    const plan = planImport([record()], [existing({})], { ...OPTIONS, allowPossibleDuplicates: true });
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.possibleDuplicates[0].included).toBe(true);
  });

  it('ignores demo rows, other statuses, and reports outside the date window', () => {
    const plan = planImport(
      [record()],
      [
        existing({ id: 'demo', is_demo: true }),
        existing({ id: 'other-status', status: 'offer_revoked' }),
        existing({ id: 'old', reported_at: '2026-08-01' }),
        existing({ id: 'other-role', role: 'Engineer' }),
      ],
      { ...OPTIONS }
    );
    // record() has no role, so "other-role" is compared on company/status/date only and does match.
    expect(plan.possibleDuplicates[0].matches.map((m) => m.existingId)).toEqual(['other-role']);
    const withRole = planImport([record({ role: 'Analyst' })], [existing({ id: 'other-role', role: 'Engineer' })], OPTIONS);
    expect(withRole.toInsert).toHaveLength(1);
  });
});

describe('importRow provenance', () => {
  it('always writes is_demo=false with the batch id and full provenance', () => {
    const [r] = planImport([record()], [], OPTIONS).toInsert;
    expect(importRow(r, 'batch-x')).toMatchObject({
      is_demo: false,
      import_batch_id: 'batch-x',
      import_key: r.importKey,
      source_url: 'https://example.org/fixture/alpha',
      source_reference: null,
      collected_at: '2026-09-05',
      evidence_type: 'news_report',
      verification_status: 'unverified',
      verified_at: null,
      source_type: 'public',
    });
  });

  it('gives the same file on the same day the same batch id', () => {
    expect(computeBatchId(fixtureCsv, TODAY)).toBe(computeBatchId(fixtureCsv, TODAY));
    expect(computeBatchId(fixtureCsv, TODAY)).not.toBe(computeBatchId(`${fixtureCsv}\n`, TODAY));
  });
});

describe('prepareImport (dry run)', () => {
  it('only reads from the database', async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: [], error: null }));
    const plan = await prepareImport(client, parseInput(fixtureCsv, 'csv'), OPTIONS);
    expect(plan.toInsert).toHaveLength(2);
    expect(writes(queries)).toEqual([]);
    expect(queries.every((q) => q.table === 'offer_reports' && op(q, 'select'))).toBe(true);
    const lookup = queries.find((q) => op(q, 'in'));
    expect(op(lookup!, 'in')!.args).toEqual(['company_slug', ['fixture-alpha-ltd', 'fixture-beta-ltd']]);
  });

  it('stops with a migration hint when the provenance columns are missing', async () => {
    const { client, queries } = createFakeSupabase(() => ({ data: null, error: { message: 'column offer_reports.import_key does not exist' } }));
    await expect(prepareImport(client, [record()], OPTIONS)).rejects.toThrow(/20261010000002_add_report_provenance\.sql/);
    expect(queries).toHaveLength(1);
  });
});

describe('commitImport', () => {
  it('inserts with ON CONFLICT DO NOTHING on import_key and never updates or deletes', async () => {
    const plan = planImport([record(), record({ companyName: 'Fixture Beta Ltd' })], [], OPTIONS);
    const [a, b] = plan.toInsert;
    // The database reports only the first row as inserted: the second was inserted concurrently.
    const { client, queries } = createFakeSupabase(() => ({ data: [{ id: 'new-1', import_key: a.importKey }], error: null }));

    const result = await commitImport(client, plan);

    expect(result).toEqual({ inserted: [{ row: a.row, id: 'new-1' }], skippedConcurrent: [b.row] });
    expect(queries).toHaveLength(1);
    expect(writes(queries).map((o) => o.name)).toEqual(['upsert']);
    const upsert = op(queries[0], 'upsert')!;
    expect(upsert.args[1]).toEqual({ onConflict: 'import_key', ignoreDuplicates: true });
    expect((upsert.args[0] as { is_demo: boolean; import_batch_id: string }[]).every((r) => !r.is_demo && r.import_batch_id === plan.batchId)).toBe(true);
  });

  it('reports a failed insert as safe to re-run', async () => {
    const plan = planImport([record()], [], OPTIONS);
    const { client } = createFakeSupabase(() => ({ data: null, error: { message: 'boom' } }));
    await expect(commitImport(client, plan)).rejects.toThrow(ImportError);
    await expect(commitImport(client, plan)).rejects.toThrow(/Re-running the same file is safe/);
  });
});

describe('parseInput', () => {
  it('accepts a JSON array and rejects anything else', () => {
    expect(parseInput('[{"a":1}]', 'json')).toEqual([{ a: 1 }]);
    expect(() => parseInput('{"a":1}', 'json')).toThrow(ImportError);
    expect(() => parseInput('not json', 'json')).toThrow(ImportError);
  });
});
