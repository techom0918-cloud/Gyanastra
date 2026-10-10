import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { AuthUser } from '@/lib/auth/types';
import { setCareerRepositoryFactoryForTesting } from '@/lib/career/context';
import { CareerStoreError, type CareerRepository } from '@/lib/career/repository';
import { setRepositoryForTesting } from '@/lib/db/config';
import { createMemoryRepository } from '@/lib/db/memory-repository';
import * as overviewRoute from '@/app/api/career/route';
import * as profileRoute from '@/app/api/career/profile/route';
import * as assessRoute from '@/app/api/career/assess/route';
import * as progressRoute from '@/app/api/career/progress/route';
import { createMemoryCareerStore } from '../support/career-memory';

// The signed-in user is whatever this variable says; the session is the only source of identity.
let currentUser: AuthUser | null = null;
vi.mock('@/lib/auth/server', () => ({
  getCurrentUser: vi.fn(async () => currentUser),
  getAuthenticatedSession: vi.fn(async () => {
    throw new Error('the real Supabase client must not be used in these tests');
  }),
}));
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), connection: vi.fn(async () => {}) }));

const alice: AuthUser = { id: 'user-alice', email: 'alice@example.com', name: 'Alice' };
const bob: AuthUser = { id: 'user-bob', email: 'bob@example.com', name: 'Bob' };

const req = (method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/career', { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });

let store: ReturnType<typeof createMemoryCareerStore>;

beforeEach(() => {
  store = createMemoryCareerStore();
  setCareerRepositoryFactoryForTesting(async (user) => store.forUser(user.id));
  setRepositoryForTesting(createMemoryRepository());
  currentUser = alice;
  delete process.env.ANTHROPIC_API_KEY;
});
afterEach(() => {
  setCareerRepositoryFactoryForTesting(null);
  setRepositoryForTesting(null);
});

const saveProfile = (body: unknown = { status: 'employed', targetRole: 'Backend Engineer', experienceMonths: 12, tenureMonths: 6 }) => profileRoute.PUT(req('PUT', body));
const assess = (kind: string, input?: unknown) => assessRoute.POST(req('POST', { kind, input }));

describe('authentication', () => {
  it('rejects every endpoint without a session and never touches the store', async () => {
    currentUser = null;
    const spy = vi.fn();
    setCareerRepositoryFactoryForTesting(async () => {
      spy();
      return store.forUser('x');
    });
    const responses = await Promise.all([
      overviewRoute.GET(),
      overviewRoute.DELETE(req('DELETE')),
      saveProfile(),
      assess('offer_risk', { offerStage: 'offer_received' }),
      progressRoute.PUT(req('PUT', { assessmentId: '11111111-1111-4111-8111-111111111111', taskId: 'd30-1', done: true })),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('answers 503 (not a crash) when accounts are not configured on the server', async () => {
    setCareerRepositoryFactoryForTesting(null);
    const res = await overviewRoute.GET();
    expect(res.status).toBe(503);
  });

  it('rate limits a single account, but not other accounts', async () => {
    for (let i = 0; i < 60; i++) expect((await overviewRoute.GET()).status).toBe(200);
    const limited = await overviewRoute.GET();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    currentUser = bob;
    expect((await overviewRoute.GET()).status).toBe(200);
  });

  it('refuses cross-origin writes', async () => {
    const headers = { origin: 'https://evil.example', host: 'localhost' };
    expect((await profileRoute.PUT(req('PUT', { status: 'student' }, headers))).status).toBe(403);
    expect((await overviewRoute.DELETE(req('DELETE', undefined, headers))).status).toBe(403);
    expect((await assessRoute.POST(req('POST', { kind: 'offer_risk', input: {} }, headers))).status).toBe(403);
    expect((await progressRoute.PUT(req('PUT', {}, headers))).status).toBe(403);
  });
});

describe('profile', () => {
  it('saves and returns a valid profile, scoped to the caller', async () => {
    const res = await saveProfile({ status: 'student', targetRole: 'Data Analyst', skills: ['SQL'] });
    expect(res.status).toBe(200);
    const overview = await (await overviewRoute.GET()).json();
    expect(overview.profile).toMatchObject({ status: 'student', targetRole: 'Data Analyst', skills: ['SQL'] });
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('validates input with field errors and does not store invalid data', async () => {
    const res = await saveProfile({ status: 'employed', tenureMonths: -5, salaryMinLpa: 20, salaryMaxLpa: 10 });
    expect(res.status).toBe(400);
    expect((await res.json()).details).toBeDefined();
    expect((await (await overviewRoute.GET()).json()).profile).toBeNull();
  });

  it('rejects personal identifiers in free text', async () => {
    const res = await saveProfile({ status: 'student', goals: 'Reach me at jane@example.com or 98765 43210' });
    expect(res.status).toBe(400);
    expect((await res.json()).details.goals).toBeDefined();
  });

  it('rejects malformed JSON', async () => {
    const res = await profileRoute.PUT(new NextRequest('http://localhost/api/career/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{nope' }));
    expect(res.status).toBe(400);
  });

  it('ignores a user id supplied by the client', async () => {
    await saveProfile({ status: 'student', userId: bob.id, user_id: bob.id });
    currentUser = bob;
    expect((await (await overviewRoute.GET()).json()).profile).toBeNull();
    currentUser = alice;
    expect((await (await overviewRoute.GET()).json()).profile).not.toBeNull();
  });
});

describe('ownership and cross-user denial', () => {
  it("never shows one user's profile or assessments to another", async () => {
    await saveProfile();
    await assess('job_stability', { stage: 'considering', ratings: { compensation: 2 } });
    await assess('offer_risk', { offerStage: 'offer_received' });

    currentUser = bob;
    const overview = await (await overviewRoute.GET()).json();
    expect(overview.profile).toBeNull();
    expect(overview.offerRisk).toBeNull();
    expect(overview.jobStability).toBeNull();
    expect(overview.actionPlan).toBeNull();
  });

  it("does not let another user tick off, or probe, someone's plan", async () => {
    await saveProfile();
    const planId = (await (await assess('action_plan', {})).json()).assessment.id as string;

    currentUser = bob;
    const denied = await progressRoute.PUT(req('PUT', { assessmentId: planId, taskId: 'd30-1', done: true }));
    expect(denied.status).toBe(404);
    const missing = await progressRoute.PUT(req('PUT', { assessmentId: '99999999-9999-4999-8999-999999999999', taskId: 'd30-1', done: true }));
    expect(missing.status).toBe(404);
    expect(await denied.json()).toEqual(await missing.json()); // indistinguishable

    currentUser = alice;
    const plan = (await (await overviewRoute.GET()).json()).actionPlan;
    expect(plan.completedTaskIds).toEqual([]);
  });

  it("deleting data removes only the caller's own", async () => {
    await saveProfile();
    currentUser = bob;
    await saveProfile({ status: 'seeking' });
    await assess('offer_risk', { offerStage: 'offer_received' });

    expect((await overviewRoute.DELETE(req('DELETE'))).status).toBe(200);
    const bobAfter = await (await overviewRoute.GET()).json();
    expect(bobAfter.profile).toBeNull();
    expect(bobAfter.offerRisk).toBeNull();

    currentUser = alice;
    expect((await (await overviewRoute.GET()).json()).profile).toMatchObject({ status: 'employed' });
  });
});

describe('assessments', () => {
  it('stores an offer-risk assessment with its evidence, and returns it in the overview', async () => {
    const res = await assess('offer_risk', { offerStage: 'bg_verification_pending', hasWrittenOffer: 'no', joiningDateConfirmed: 'unknown' });
    expect(res.status).toBe(201);
    const { assessment } = await res.json();
    expect(assessment.result.kind).toBe('offer_risk');
    expect(assessment.result.evidence.length).toBeGreaterThan(0);
    expect((await (await overviewRoute.GET()).json()).offerRisk.id).toBe(assessment.id);
  });

  it('adds real company context when community reports exist for the named company', async () => {
    const res = await assess('offer_risk', { offerStage: 'offer_received', companyName: 'Totally Unknown Co' });
    const { assessment } = await res.json();
    expect(assessment.result.company).toMatchObject({ matched: false, usedAsContext: false });
  });

  it('rejects invalid assessment input and unknown kinds', async () => {
    expect((await assess('offer_risk', { offerStage: 'nonsense' })).status).toBe(400);
    expect((await assess('job_stability', { stage: 'considering', ratings: { compensation: 9 } })).status).toBe(400);
    expect((await assess('mind_reading', {})).status).toBe(400);
    expect((await assess('offer_risk', { offerStage: 'offer_received', companyName: 'Acme, call 9876543210' })).status).toBe(400);
  });

  it('fills job-stability gaps from the saved profile', async () => {
    await saveProfile({ status: 'employed', experienceMonths: 12, tenureMonths: 6, financialRunwayMonths: 2, noticePeriodDays: 90 });
    const { assessment } = await (await assess('job_stability', { stage: 'considering', hasAlternativeOffer: 'no' })).json();
    const topics = assessment.result.practical.map((p: { topic: string }) => p.topic);
    expect(topics).toContain('Savings');
    expect(topics).toContain('Notice period');
  });

  it('requires a profile before generating an action plan', async () => {
    const res = await assess('action_plan', {});
    expect(res.status).toBe(409);
  });

  it('generates a rules-based plan and records progress against stable task ids', async () => {
    await saveProfile();
    const res = await assess('action_plan', {});
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ source: 'rules', fallbackReason: 'not_requested' });
    const taskId = body.assessment.result.phases[0].tasks[0].id as string;

    expect((await progressRoute.PUT(req('PUT', { assessmentId: body.assessment.id, taskId, done: true }))).status).toBe(200);
    expect((await (await overviewRoute.GET()).json()).actionPlan.completedTaskIds).toEqual([taskId]);
    expect((await progressRoute.PUT(req('PUT', { assessmentId: body.assessment.id, taskId, done: false }))).status).toBe(200);
    expect((await (await overviewRoute.GET()).json()).actionPlan.completedTaskIds).toEqual([]);
  });

  it('regenerating replaces the current plan without losing the account', async () => {
    await saveProfile();
    const first = (await (await assess('action_plan', {})).json()).assessment.id;
    await saveProfile({ status: 'seeking', targetRole: 'Product Analyst' });
    const second = (await (await assess('action_plan', {})).json()).assessment.id;
    expect(second).not.toBe(first);
    expect((await (await overviewRoute.GET()).json()).actionPlan.id).toBe(second);
  });

  it('falls back to the rules plan, saying why, when AI is requested but not configured', async () => {
    await saveProfile();
    const body = await (await assess('action_plan', { useAi: true })).json();
    expect(body).toMatchObject({ source: 'rules', fallbackReason: 'not_configured' });
    expect(body.assessment.result.disclaimer).toMatch(/no AI/);
  });
});

describe('safe failures', () => {
  const failing = (error: Error): CareerRepository => {
    const fail = async () => {
      throw error;
    };
    return { getProfile: fail, saveProfile: fail, latestAssessments: fail, saveAssessment: fail, setTaskDone: fail, deleteAll: fail };
  };

  it('answers 503 with a friendly message when the migration has not been applied', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setCareerRepositoryFactoryForTesting(async () => failing(new CareerStoreError('not_enabled', 'tables missing; apply migration 20261010000005')));
    const res = await overviewRoute.GET();
    expect(res.status).toBe(503);
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/migration|20261010/); // internals stay in the server log
    spy.mockRestore();
  });

  it('hides database error detail from the client', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setCareerRepositoryFactoryForTesting(async () => failing(new CareerStoreError('query_failed', 'permission denied for table career_profiles')));
    const res = await saveProfile();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/permission denied|career_profiles/);
    spy.mockRestore();
  });
});
