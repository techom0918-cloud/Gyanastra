// Runs against a real Supabase project. Requires SUPABASE_URL, SUPABASE_SECRET_KEY and AAGEY_DB_TEST=1
// (from the environment or .env.local), with the migration in supabase/migrations already applied.
// Writes rows tagged with TEST_TAG and deletes only the rows this file created.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { StoreError } from '@/lib/db/repository';
import { createSupabaseRepository } from '@/lib/db/supabase-repository';

try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local: rely on the process environment.
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const enabled = process.env.AAGEY_DB_TEST === '1' && !!url && !!key;

const TEST_TAG = '[aagey-integration-test]';

// Each call makes an independent client, standing in for a fresh server process.
function freshClient(): SupabaseClient {
  return createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
}

describe.skipIf(!enabled)('Supabase repository (live database)', () => {
  const created = { reports: [] as string[], offers: [] as string[] };
  const slug = `aagey-integration-test-${Date.now()}`;

  afterAll(async () => {
    const admin = freshClient();
    if (created.reports.length) await admin.from('offer_reports').delete().in('id', created.reports);
    if (created.offers.length) await admin.from('tracked_offers').delete().in('id', created.offers);
  });

  it('persists a submitted report so a new client can read it back', async () => {
    const report = await createSupabaseRepository(freshClient()).insertReport({
      companySlug: slug,
      companyName: 'Aagey Integration Test',
      status: 'joining_delayed',
      description: TEST_TAG,
      delayWeeks: 2.5,
      graduationYear: 2026,
      reportedAt: new Date().toISOString().slice(0, 10),
      sourceType: 'community',
      isDemo: false,
    });
    created.reports.push(report.id);

    const readBack = await createSupabaseRepository(freshClient()).listReportsByCompany(slug);
    expect(readBack).toEqual([report]);
    expect(readBack[0]).toMatchObject({ delayWeeks: 2.5, isDemo: false, description: TEST_TAG });
  });

  it('persists a tracked-offer update so a new client sees it', async () => {
    const offer = await createSupabaseRepository(freshClient()).insertTrackedOffer({
      companySlug: slug,
      companyName: 'Aagey Integration Test',
      currentStatus: 'offer_received',
      notes: TEST_TAG,
      isDemo: false,
    });
    created.offers.push(offer.id);

    const updated = await createSupabaseRepository(freshClient()).updateTrackedOffer(offer.id, {
      currentStatus: 'joining_confirmed',
    });
    expect(updated?.currentStatus).toBe('joining_confirmed');

    const all = await createSupabaseRepository(freshClient()).listTrackedOffers();
    expect(all.find((o) => o.id === offer.id)).toMatchObject({ currentStatus: 'joining_confirmed', notes: TEST_TAG });
  });

  it('returns null when updating an id that does not exist', async () => {
    const result = await createSupabaseRepository(freshClient()).updateTrackedOffer(`missing-${Date.now()}`, { notes: 'x' });
    expect(result).toBeNull();
  });

  it('rejects rows that violate the schema constraints', async () => {
    // Own slug, so the "nothing persisted" check below is not affected by the other tests' rows.
    const constraintSlug = `${slug}-constraint`;
    let thrown: unknown;
    try {
      const report = await createSupabaseRepository(freshClient()).insertReport({
        companySlug: constraintSlug,
        companyName: 'Aagey Integration Test',
        // @ts-expect-error deliberately invalid status to exercise the CHECK constraint
        status: 'not_a_status',
        description: TEST_TAG,
        reportedAt: '2026-01-01',
        sourceType: 'community',
        isDemo: false,
      });
      // Only reached if the constraint is missing; record the row so afterAll removes it.
      created.reports.push(report.id);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(StoreError);
    expect(thrown).toMatchObject({ kind: 'query_failed' });
    // 23514 is Postgres check_violation; the inline CHECK on offer_reports.status gets this default name.
    expect((thrown as StoreError).cause).toMatchObject({
      code: '23514',
      message: expect.stringContaining('"offer_reports_status_check"'),
    });

    const persisted = await createSupabaseRepository(freshClient()).listReportsByCompany(constraintSlug);
    expect(persisted).toEqual([]);
  });
});
