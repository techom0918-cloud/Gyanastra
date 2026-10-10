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

// connection() needs a live Next.js request context; the handlers are exercised directly here.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn(async () => {}),
}));

function request(method: string, body?: unknown, raw?: string) {
  return new NextRequest('http://localhost/api/test', {
    method,
    headers: { 'content-type': 'application/json' },
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
    listTrackedOffers: fail,
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
    expect((await trackerRoute.PATCH(request('PATCH', { id: 'missing', notes: 'x' }))).status).toBe(404);
  });

  it('PATCH /api/tracker updates allowed fields and ignores protected ones', async () => {
    const res = await trackerRoute.PATCH(
      request('PATCH', { id: 'demo-tracked-1', notes: 'Joining confirmed', isDemo: false, companySlug: 'hacked' })
    );
    expect(res.status).toBe(200);
    const { offer } = await res.json();
    expect(offer).toMatchObject({ id: 'demo-tracked-1', notes: 'Joining confirmed', isDemo: true, companySlug: 'infosys' });
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
    expect((await trackerRoute.PATCH(request('PATCH', { id: 'x', notes: 'y' }))).status).toBe(500);
    expect((await trackerRoute.GET()).status).toBe(500);
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
