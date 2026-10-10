// Live test of the submission rate-limit storage. Same requirements as supabase.test.ts, plus
// supabase/migrations/20261010000003_add_report_submitter_hash.sql. Deletes only the row it creates.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { createSupabaseRepository, SUBMITTER_HASH_MIGRATION } from '@/lib/db/supabase-repository';

try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local: rely on the process environment.
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const enabled = process.env.AAGEY_DB_TEST === '1' && !!url && !!key;
const TEST_TAG = '[aagey-integration-test]';

function freshClient(): SupabaseClient {
  return createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
}

let migrationApplied = false;
if (enabled) {
  const { error } = await freshClient().from('offer_reports').select('submitter_hash').limit(1);
  migrationApplied = !error;
  if (error) console.warn(`[abuse.test] SKIPPED: apply ${SUBMITTER_HASH_MIGRATION} first (${error.message}).`);
}

describe.skipIf(!enabled || !migrationApplied)('submission rate-limit storage (live database)', () => {
  const created: string[] = [];
  const hash = `test${Date.now().toString(16)}`.padEnd(32, '0').slice(0, 32);

  afterAll(async () => {
    if (created.length) await freshClient().from('offer_reports').delete().in('id', created);
  });

  it('records the submitter hash and finds it again from a fresh client, without exposing it', async () => {
    const since = new Date(Date.now() - 60_000).toISOString();
    const report = await createSupabaseRepository(freshClient()).insertReport(
      {
        companySlug: `aagey-abuse-test-${Date.now()}`,
        companyName: 'Aagey Abuse Test',
        status: 'joining_delayed',
        description: TEST_TAG,
        reportedAt: new Date().toISOString().slice(0, 10),
        sourceType: 'community',
        isDemo: false,
      },
      { submitterHash: hash }
    );
    created.push(report.id);
    expect(report).not.toHaveProperty('submitterHash');

    const recent = await createSupabaseRepository(freshClient()).listSubmissionsBySubmitter(hash, since);
    expect(recent).toEqual([{ companySlug: report.companySlug, status: 'joining_delayed', createdAt: expect.any(String) }]);
  });
});
