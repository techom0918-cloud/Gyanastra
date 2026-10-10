import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveStorageConfig, setRepositoryForTesting } from '@/lib/db/config';
import { createMemoryRepository } from '@/lib/db/memory-repository';
import { SEED_REPORTS } from '@/lib/db/seed';
import * as store from '@/lib/db/store';
import { computeReliabilityIndicator } from '@/lib/scoring/reliability';

beforeEach(() => setRepositoryForTesting(createMemoryRepository()));
afterEach(() => setRepositoryForTesting(null));

describe('store (over the memory backend)', () => {
  it('serves the 25 demo reports across 6 companies, all marked demo', async () => {
    const reports = await store.getAllReports();
    expect(reports).toHaveLength(25);
    expect(reports.every((r) => r.isDemo === true)).toBe(true);
    expect(await store.getDashboardStats()).toEqual({ total: 25, companies: 6, delayed: 9, revoked: 2, confirmed: 11, demo: 25 });
  });

  it('sorts reports newest first', async () => {
    const dates = (await store.getAllReports()).map((r) => r.reportedAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('stores a submission as non-demo community data and counts it in stats', async () => {
    const created = await store.addReport({ companyName: 'New Co Ltd.', status: 'offer_revoked' });
    expect(created).toMatchObject({ companySlug: 'new-co-ltd', sourceType: 'community', isDemo: false });

    const stats = await store.getDashboardStats();
    expect(stats.total).toBe(26);
    expect(stats.companies).toBe(7);
    expect(stats.revoked).toBe(3);
    expect((await store.getCompanySummary('new-co-ltd'))?.reportCount).toBe(1);
  });

  it('computes company scores from the stored records', async () => {
    const infosys = SEED_REPORTS.filter((r) => r.companySlug === 'infosys');
    const summary = await store.getCompanySummary('infosys');
    expect(summary?.reportCount).toBe(6);
    expect(summary?.reliabilityIndicator).toEqual(computeReliabilityIndicator(infosys));

    const companies = await store.getAllCompanies();
    expect(companies.map((c) => c.slug)).toEqual(['infosys', 'tcs', 'wipro', 'capgemini', 'cognizant', 'deloitte']);
  });

  it('returns null for an unknown company', async () => {
    expect(await store.getCompanySummary('nope')).toBeNull();
  });

  it('adds, updates and re-slugs tracked offers, recomputing alerts on read', async () => {
    const offer = await store.addTrackedOffer({ companyName: 'Wipro', currentStatus: 'offer_received' });
    expect(offer).toMatchObject({ companySlug: 'wipro', isDemo: false, alerts: [] });

    const updated = await store.updateTrackedOffer(offer.id, { companyName: 'Capgemini', notes: 'moved' });
    expect(updated).toMatchObject({ companySlug: 'capgemini', notes: 'moved' });

    const offers = await store.getTrackedOffers([offer.id]);
    expect(offers).toHaveLength(2);
    expect(offers[0].isDemo).toBe(true);
    expect(offers.find((o) => o.id === offer.id)?.companySlug).toBe('capgemini');
  });

  it('returns null when updating an unknown tracked offer', async () => {
    expect(await store.updateTrackedOffer('missing', { notes: 'x' })).toBeNull();
  });

  it('shows each viewer only demo offers and the offers whose ids they hold (regression: all offers were public)', async () => {
    const mine = await store.addTrackedOffer({ companyName: 'Acme', currentStatus: 'offer_received', notes: 'private' });
    const theirs = await store.addTrackedOffer({ companyName: 'Other', currentStatus: 'offer_received' });
    expect(mine.id).toMatch(/^[0-9a-f-]{36}$/); // unguessable

    const visible = (await store.getTrackedOffers([mine.id])).map((o) => o.id);
    expect(visible).toContain(mine.id);
    expect(visible).not.toContain(theirs.id);
    expect((await store.getTrackedOffers([])).every((o) => o.isDemo)).toBe(true);
  });

  it('keeps demo tracked offers read-only', async () => {
    expect(await store.updateTrackedOffer('demo-tracked-1', { notes: 'vandalised' })).toBeNull();
    const [demo] = await store.getTrackedOffers([]);
    expect(demo.notes).not.toBe('vandalised');
  });

  it('builds alerts for real offers from real reports only, never from demo reports', async () => {
    // The seed has two demo Wipro reports from the last few months, one of them a revocation.
    const offer = await store.addTrackedOffer({ companyName: 'Wipro', currentStatus: 'offer_received' });
    const [real] = (await store.getTrackedOffers([offer.id])).filter((o) => !o.isDemo);
    expect(real.alerts.map((a) => a.type)).toEqual(['info']); // only "limited community data"
    expect(real.alerts[0].message).toContain('Only 0 reports');
  });

  it('scores companies from real reports only once any exist', async () => {
    await store.addReport({ companyName: 'Infosys', status: 'offer_revoked' });
    const summary = await store.getCompanySummary('infosys');
    expect(summary?.reliabilityIndicator).toMatchObject({ basis: 'real', score: null, excluded: { demo: 6, futureOrInvalidDate: 0 } });
  });
});

describe('resolveStorageConfig', () => {
  const creds = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'k' };

  it('uses memory when nothing is configured', () => {
    expect(resolveStorageConfig({})).toEqual({ mode: 'memory' });
  });

  it('uses Supabase automatically when both credentials are set', () => {
    expect(resolveStorageConfig(creds)).toEqual({ mode: 'supabase', url: creds.SUPABASE_URL, secretKey: 'k' });
  });

  it('refuses to fall back to memory when Supabase is required but not configured', () => {
    expect(() => resolveStorageConfig({ AAGEY_STORAGE: 'supabase' })).toThrow(/not set/);
    expect(() => resolveStorageConfig({ AAGEY_STORAGE: 'supabase', SUPABASE_URL: 'https://x' })).toThrow();
  });

  it('honours an explicit memory override and rejects unknown modes', () => {
    expect(resolveStorageConfig({ ...creds, AAGEY_STORAGE: 'memory' })).toEqual({ mode: 'memory' });
    expect(() => resolveStorageConfig({ AAGEY_STORAGE: 'mysql' })).toThrow(/Unknown/);
  });
});
