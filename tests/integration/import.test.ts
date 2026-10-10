// Live import pipeline test. Same requirements as supabase.test.ts, plus the provenance migration
// (supabase/migrations/20261010000002_add_report_provenance.sql). Inserts tagged fixture rows under a
// unique batch id and deletes only rows with that batch id.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { createSupabaseRepository } from '@/lib/db/supabase-repository';
import { assertImportSchema, commitImport, importRow, planImport, prepareImport, PlanOptions } from '@/lib/import/importer';
import { TEST_TAG } from '@/lib/import/validate';

try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local: rely on the process environment.
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const enabled = process.env.AAGEY_DB_TEST === '1' && !!url && !!key;

function freshClient(): SupabaseClient {
  return createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
}

let migrationApplied = false;
if (enabled) {
  try {
    await assertImportSchema(freshClient());
    migrationApplied = true;
  } catch (error) {
    console.warn(`[import.test] SKIPPED: ${(error as Error).message}`);
  }
}

describe.skipIf(!enabled || !migrationApplied)('import pipeline (live database)', () => {
  const stamp = Date.now();
  const batchId = `import-test-${stamp}`;
  const companyName = `Aagey Import Test ${stamp}`;
  const slug = `aagey-import-test-${stamp}`;
  const today = new Date().toISOString().slice(0, 10);
  const options: PlanOptions = { today, batchId, testFixtures: true };

  const records = [
    {
      companyName,
      status: 'joining_delayed',
      reportedAt: today,
      delayWeeks: 3,
      description: `${TEST_TAG} imported fixture`,
      evidenceType: 'news_report',
      sourceUrl: `https://example.org/aagey-import-test/${stamp}`,
      collectedAt: today,
    },
    {
      companyName,
      status: 'offer_revoked',
      reportedAt: today,
      description: `${TEST_TAG} verified fixture`,
      evidenceType: 'official_notice',
      // base36: a raw 13-digit timestamp would (correctly) trip the phone-number guard.
      sourceReference: `Fixture notice FX-${stamp.toString(36)}`,
      collectedAt: today,
      verificationStatus: 'verified',
      verifiedAt: today,
      verificationNote: 'Integration test fixture; no real source was reviewed',
    },
  ];

  afterAll(async () => {
    // Only this run's batch; never touches demo, community or other imported rows.
    await freshClient().from('offer_reports').delete().eq('import_batch_id', batchId);
  });

  it('dry run plans the inserts without writing anything', async () => {
    const plan = await prepareImport(freshClient(), records, options);
    expect(plan.toInsert).toHaveLength(2);
    expect(plan.rejected).toEqual([]);
    expect(await createSupabaseRepository(freshClient()).listReportsByCompany(slug)).toEqual([]);
  });

  it('commits with provenance, keeps the API shape, and skips everything on a re-run', async () => {
    const plan = await prepareImport(freshClient(), records, options);
    const result = await commitImport(freshClient(), plan);
    expect(result.inserted).toHaveLength(2);
    expect(result.skippedConcurrent).toEqual([]);

    const { data, error } = await freshClient()
      .from('offer_reports')
      .select('is_demo, source_type, import_batch_id, evidence_type, verification_status')
      .eq('import_batch_id', batchId)
      .order('status');
    expect(error).toBeNull();
    expect(data).toEqual([
      { is_demo: false, source_type: 'public', import_batch_id: batchId, evidence_type: 'news_report', verification_status: 'unverified' },
      { is_demo: false, source_type: 'verified', import_batch_id: batchId, evidence_type: 'official_notice', verification_status: 'verified' },
    ]);

    // The app's report shape is unchanged: provenance columns are not exposed through the repository.
    const reports = await createSupabaseRepository(freshClient()).listReportsByCompany(slug);
    expect(reports).toHaveLength(2);
    for (const r of reports) {
      expect(Object.keys(r).sort()).toEqual(
        expect.arrayContaining(['companyName', 'companySlug', 'id', 'isDemo', 'reportedAt', 'sourceType', 'status'])
      );
      expect(r).not.toHaveProperty('importKey');
      expect(r).not.toHaveProperty('sourceUrl');
    }

    const rerun = await prepareImport(freshClient(), records, options);
    expect(rerun.toInsert).toEqual([]);
    expect(rerun.alreadyImported.map((a) => a.row)).toEqual([1, 2]);
  });

  it('the database itself refuses a "verified" row without a recorded review', async () => {
    const [valid] = planImport([records[0]], [], options).toInsert;
    const row = { ...importRow(valid, batchId), import_key: `${valid.importKey}-unreviewed`, verification_status: 'verified' };
    const { error } = await freshClient().from('offer_reports').insert(row);
    expect(error).toMatchObject({ code: '23514', message: expect.stringContaining('offer_reports_verification_check') });
  });

  it('the database itself refuses an imported row flagged as demo', async () => {
    const [valid] = planImport([records[0]], [], options).toInsert;
    const row = { ...importRow(valid, batchId), import_key: `${valid.importKey}-demo`, is_demo: true };
    const { error } = await freshClient().from('offer_reports').insert(row);
    expect(error).toMatchObject({ code: '23514', message: expect.stringContaining('offer_reports_import_provenance_check') });
  });
});
