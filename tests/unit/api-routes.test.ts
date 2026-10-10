import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setRepositoryForTesting } from '@/lib/db/config';
import { createMemoryRepository } from '@/lib/db/memory-repository';
import { Repository, StoreError } from '@/lib/db/repository';
import * as reportsRoute from '@/app/api/reports/route';
import * as trackerRoute from '@/app/api/tracker/route';
import * as dashboardRoute from '@/app/api/dashboard/route';
import * as companiesRoute from '@/app/api/companies/route';
import * as companyRoute from '@/app/api/companies/[slug]/route';
import * as classifyRoute from '@/app/api/classify-report/route';

// connection() needs a live Next.js request context; the handlers are exercised directly here.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn(async () => {}),
}));

function request(method: string, body?: unknown, raw?: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/test', {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

function failingRepository(error: Error): Repository {
  const fail = async () => {
    throw error;
  };
  return {
    mode: 'supabase',
    listReports: fail,
    listReportsByCompany: fail,
    insertReport: fail,
    listSubmissionsBySubmitter: fail,
    listTrackedOffers: fail,
    listTrackedOffersForViewer: fail,
    listTrackedOffersForUser: fail,
    supportsUserOffers: fail,
    insertTrackedOffer: fail,
    updateTrackedOffer: fail,
  };
}

const slugParams = (slug: string) => ({ params: Promise.resolve({ slug }) });

afterEach(() => setRepositoryForTesting(null));

describe('API routes with a working store', () => {
  beforeEach(() => {
    setRepositoryForTesting(createMemoryRepository());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('GET /api/dashboard keeps its response shape and reports the backend', async () => {
    const res = await dashboardRoute.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('x-aagey-storage')).toBe('memory');
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['recentReports', 'stats']);
    expect(body.stats.total).toBe(25);
    expect(body.recentReports).toHaveLength(10);
  });

  it('POST /api/reports creates a report that later reads include', async () => {
    const res = await reportsRoute.POST(request('POST', { companyName: 'Acme', status: 'joining_confirmed', graduationYear: 2026 }));
    expect(res.status).toBe(201);
    const { report } = await res.json();
    expect(report).toMatchObject({ companySlug: 'acme', isDemo: false, sourceType: 'community' });

    const company = await (await companyRoute.GET(request('GET'), slugParams('acme'))).json();
    expect(company.reports.map((r: { id: string }) => r.id)).toEqual([report.id]);
  });

  it('POST /api/reports rejects invalid JSON and invalid fields with 400', async () => {
    expect((await reportsRoute.POST(request('POST', undefined, '{not json'))).status).toBe(400);

    const res = await reportsRoute.POST(request('POST', { companyName: 'A', status: 'bogus', graduationYear: 2026.5 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(Object.keys(body.details).sort()).toEqual(['companyName', 'graduationYear', 'status']);
  });

  it('GET /api/companies/[slug] returns 404 for unknown companies', async () => {
    expect((await companyRoute.GET(request('GET'), slugParams('nope'))).status).toBe(404);
  });

  it('PATCH /api/tracker validates input and returns 404 for unknown ids', async () => {
    expect((await trackerRoute.PATCH(request('PATCH', { notes: 'x' }))).status).toBe(400);
    expect((await trackerRoute.PATCH(request('PATCH', ['demo-tracked-1']))).status).toBe(400);
    expect((await trackerRoute.PATCH(request('PATCH', { id: 'demo-tracked-1', currentStatus: 'bogus' }))).status).toBe(400);
    expect((await trackerRoute.PATCH(request('PATCH', { id: 'missing-offer-id', notes: 'x' }))).status).toBe(404);
  });

  it('PATCH /api/tracker updates allowed fields and ignores protected ones', async () => {
    const created = await (await trackerRoute.POST(request('POST', { companyName: 'Infosys', currentStatus: 'offer_received' }))).json();
    const res = await trackerRoute.PATCH(
      request('PATCH', { id: created.offer.id, notes: 'Joining confirmed', isDemo: true, companySlug: 'hacked' })
    );
    expect(res.status).toBe(200);
    const { offer } = await res.json();
    expect(offer).toMatchObject({ id: created.offer.id, notes: 'Joining confirmed', isDemo: false, companySlug: 'infosys' });
  });

  it('PATCH /api/tracker refuses to change shared demo offers', async () => {
    expect((await trackerRoute.PATCH(request('PATCH', { id: 'demo-tracked-1', notes: 'vandalised' }))).status).toBe(404);
  });
});

describe('API routes when storage fails', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('return 500 with a generic message and never claim a write succeeded', async () => {
    setRepositoryForTesting(failingRepository(new StoreError('query_failed', 'Supabase insert failed: secret detail')));

    const post = await reportsRoute.POST(request('POST', { companyName: 'Acme', status: 'joining_confirmed' }));
    expect(post.status).toBe(500);
    const body = await post.json();
    expect(body).toEqual({ error: 'Failed to save report' });
    expect(JSON.stringify(body)).not.toContain('secret detail');

    expect((await trackerRoute.POST(request('POST', { companyName: 'Acme', currentStatus: 'offer_received' }))).status).toBe(500);
    expect((await trackerRoute.PATCH(request('PATCH', { id: 'unknown-offer-id', notes: 'y' }))).status).toBe(500);
    expect((await trackerRoute.GET(request('GET'))).status).toBe(500);
    expect((await dashboardRoute.GET()).status).toBe(500);
    expect((await companiesRoute.GET()).status).toBe(500);
    expect((await companyRoute.GET(request('GET'), slugParams('acme'))).status).toBe(500);
    expect((await reportsRoute.GET()).status).toBe(500);
  });

  it('return 503 when the database is required but not configured', async () => {
    setRepositoryForTesting(failingRepository(new StoreError('not_configured', 'missing env')));
    const res = await reportsRoute.POST(request('POST', { companyName: 'Acme', status: 'joining_confirmed' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Database is not configured' });
  });

  it('return 503 from env-based selection when AAGEY_STORAGE=supabase lacks credentials', async () => {
    vi.stubEnv('AAGEY_STORAGE', 'supabase');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    try {
      expect((await dashboardRoute.GET()).status).toBe(503);
      expect((await reportsRoute.POST(request('POST', { companyName: 'Acme', status: 'joining_confirmed' }))).status).toBe(503);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('abuse controls and privacy on write routes', () => {
  beforeEach(() => {
    setRepositoryForTesting(createMemoryRepository());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const fromIp = (ip: string, body: unknown) => request('POST', body, undefined, { 'x-forwarded-for': ip });

  it('POST /api/reports rate-limits a submitter and says when to retry, without affecting others', async () => {
    const companies = ['A Co', 'B Co', 'C Co', 'D Co'];
    const statuses = await Promise.all(
      companies.slice(0, 3).map((companyName) => reportsRoute.POST(fromIp('198.51.100.9', { companyName, status: 'joining_delayed' })))
    );
    expect(statuses.map((r) => r.status)).toEqual([201, 201, 201]);

    const limited = await reportsRoute.POST(fromIp('198.51.100.9', { companyName: companies[3], status: 'joining_delayed' }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    const body = await limited.json();
    expect(Object.keys(body)).toEqual(['error']);
    expect(JSON.stringify(body)).not.toContain('198.51.100.9');

    expect((await reportsRoute.POST(fromIp('198.51.100.10', { companyName: companies[3], status: 'joining_delayed' }))).status).toBe(201);
  });

  it('POST /api/reports rejects a same-day duplicate outcome from the same submitter with 409', async () => {
    const report = { companyName: 'Acme', status: 'offer_revoked' };
    expect((await reportsRoute.POST(fromIp('198.51.100.20', report))).status).toBe(201);
    expect((await reportsRoute.POST(fromIp('198.51.100.20', { ...report, companyName: 'ACME' }))).status).toBe(409);
    const company = await (await companyRoute.GET(request('GET'), slugParams('acme'))).json();
    expect(company.reports).toHaveLength(1);
  });

  it('POST /api/reports refuses personal information and stores nothing', async () => {
    const res = await reportsRoute.POST(
      fromIp('198.51.100.30', { companyName: 'Acme', status: 'joining_delayed', description: 'Contact me on 9876543210 or a@b.in' })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.description).toHaveLength(2);
    expect((await companyRoute.GET(request('GET'), slugParams('acme'))).status).toBe(404);
  });

  it('POST /api/reports refuses oversized payloads with 413', async () => {
    const res = await reportsRoute.POST(request('POST', undefined, JSON.stringify({ companyName: 'Acme', status: 'joining_delayed', description: 'x'.repeat(20_000) })));
    expect(res.status).toBe(413);
  });

  it('POST /api/reports ignores client attempts to set protected fields', async () => {
    const res = await reportsRoute.POST(
      fromIp('198.51.100.40', { companyName: 'Acme', status: 'joining_confirmed', isDemo: true, sourceType: 'verified', reportedAt: '2020-01-01', id: 'x' })
    );
    const { report } = await res.json();
    expect(report).toMatchObject({ isDemo: false, sourceType: 'community' });
    expect(report.id).not.toBe('x');
    expect(report.reportedAt).not.toBe('2020-01-01');
    expect(report).not.toHaveProperty('submitterHash');
  });

  it('GET /api/tracker returns only demo offers and the caller\'s own offers', async () => {
    const mine = (await (await trackerRoute.POST(request('POST', { companyName: 'Acme', currentStatus: 'offer_received', notes: 'private note' }))).json()).offer;
    const theirs = (await (await trackerRoute.POST(request('POST', { companyName: 'Other', currentStatus: 'offer_received' }))).json()).offer;

    const anonymous = await (await trackerRoute.GET(request('GET'))).json();
    expect(anonymous.offers.every((o: { isDemo: boolean }) => o.isDemo)).toBe(true);
    expect(JSON.stringify(anonymous)).not.toContain('private note');

    const own = await (await trackerRoute.GET(request('GET', undefined, undefined, { 'x-aagey-offer-ids': mine.id }))).json();
    const ids = own.offers.map((o: { id: string }) => o.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
  });

  it('GET /api/tracker rejects malformed or excessive offer-id headers', async () => {
    const bad = ["x'; drop table", Array.from({ length: 21 }, (_, i) => `id-000000${i}`).join(',')];
    for (const header of bad) {
      expect((await trackerRoute.GET(request('GET', undefined, undefined, { 'x-aagey-offer-ids': header }))).status).toBe(400);
    }
  });

  it('POST and PATCH /api/tracker refuse personal information in notes', async () => {
    expect((await trackerRoute.POST(request('POST', { companyName: 'Acme', currentStatus: 'offer_received', notes: 'HR: hr@acme.com' }))).status).toBe(400);
    const { offer } = await (await trackerRoute.POST(request('POST', { companyName: 'Acme', currentStatus: 'offer_received' }))).json();
    expect((await trackerRoute.PATCH(request('PATCH', { id: offer.id, notes: 'roll no 19CS1042' }))).status).toBe(400);
  });

  it('POST /api/classify-report enforces length limits', async () => {
    expect((await classifyRoute.POST(request('POST', { description: 'hi' }))).status).toBe(400);
    expect((await classifyRoute.POST(request('POST', { description: 'x'.repeat(1001) }))).status).toBe(400);
    expect((await classifyRoute.POST(request('POST', { description: 'Offer was revoked last week' }))).status).toBe(200);
  });

  it('GET /api/companies/[slug] returns 404 for slugs that slugify() could never produce', async () => {
    for (const slug of ['Infosys', 'a/b', '../x', 'x'.repeat(201)]) {
      expect((await companyRoute.GET(request('GET'), slugParams(slug))).status).toBe(404);
    }
  });
});
