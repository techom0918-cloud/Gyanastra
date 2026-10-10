import { describe, expect, it } from 'vitest';
import { findPersonalData, personalDataErrors } from '@/lib/privacy';
import { readJsonBody } from '@/lib/http/body';
import {
  clientAddress,
  createLocalSubmissionLog,
  decideSubmission,
  RecentSubmission,
  startOfUtcDay,
  SUBMISSION_LIMITS,
  submitterHash,
  submitterSecret,
} from '@/lib/abuse/submissions';

describe('findPersonalData', () => {
  const kinds = (text: string) => findPersonalData(text).map((m) => m.kind);

  it.each([
    ['mail me at a.b@college.edu', 'email'],
    ['call +91 98765 43210', 'phone'],
    ['aadhaar 1234 5678 9012', 'phone'],
    ['PAN ABCDE1234F', 'pan'],
    ['my roll no: 19CS1042', 'student_id'],
    ['Reg. number 2021-ECE-118', 'student_id'],
    ['USN 1RV20CS001', 'student_id'],
    ['student id A12345', 'student_id'],
  ])('flags %j as %s', (text, kind) => {
    expect(kinds(text)).toContain(kind);
  });

  it.each([
    'Joining pushed from July to October, delayed by 12 weeks',
    'registration 2026 batch, class of 2026',
    'offer on 2026-03-04, CTC 6.5 LPA (650000)',
    'Systems Engineer, onboarding on 15/07/2026',
    'Placement cell notice PC/26/112',
  ])('does not flag ordinary report text: %j', (text) => {
    expect(findPersonalData(text)).toEqual([]);
  });

  it('reports errors per field and skips empty fields', () => {
    expect(personalDataErrors({ description: 'x@y.co', role: undefined, companyName: 'Acme' })).toEqual({
      description: ['contains an email address; remove personal data'],
    });
  });
});

describe('decideSubmission', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const at = (minutesAgo: number, companySlug = 'acme', status = 'joining_delayed'): RecentSubmission => ({
    companySlug,
    status,
    createdAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
  });

  it('allows a first submission', () => {
    expect(decideSubmission([], { companySlug: 'acme', status: 'offer_revoked' }, now)).toEqual({ allowed: true });
  });

  it('rejects the same outcome for the same company on the same day as a duplicate (409)', () => {
    const d = decideSubmission([at(300)], { companySlug: 'acme', status: 'joining_delayed' }, now);
    expect(d).toMatchObject({ allowed: false, status: 409 });
  });

  it(`limits ${SUBMISSION_LIMITS.perWindow} reports per ${SUBMISSION_LIMITS.windowMinutes} minutes, with Retry-After`, () => {
    const recent = [at(9, 'a'), at(5, 'b'), at(1, 'c')];
    const d = decideSubmission(recent, { companySlug: 'd', status: 'offer_revoked' }, now);
    expect(d).toMatchObject({ allowed: false, status: 429, retryAfterSeconds: 60 });
    // Once the oldest leaves the window it is allowed again.
    expect(decideSubmission([at(11, 'a'), at(5, 'b'), at(1, 'c')], { companySlug: 'd', status: 'offer_revoked' }, now).allowed).toBe(true);
  });

  it(`limits ${SUBMISSION_LIMITS.perDay} reports per UTC day`, () => {
    const recent = Array.from({ length: SUBMISSION_LIMITS.perDay }, (_, i) => at(60 + i * 20, `c${i}`));
    const d = decideSubmission(recent, { companySlug: 'new', status: 'offer_revoked' }, now);
    expect(d).toMatchObject({ allowed: false, status: 429, retryAfterSeconds: 12 * 3600 });
  });
});

describe('submitter identity', () => {
  const now = new Date('2026-10-10T12:00:00Z');

  it('hashes the address with the day, so hashes rotate daily and never contain the address', () => {
    const a = submitterHash('203.0.113.7', now, 'secret');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain('203');
    expect(submitterHash('203.0.113.7', new Date('2026-10-10T23:59:59Z'), 'secret')).toBe(a);
    expect(submitterHash('203.0.113.7', new Date('2026-10-11T00:00:00Z'), 'secret')).not.toBe(a);
    expect(submitterHash('203.0.113.8', now, 'secret')).not.toBe(a);
    expect(submitterHash('203.0.113.7', now, 'other-secret')).not.toBe(a);
  });

  it('takes the first x-forwarded-for entry, then x-real-ip, else a shared bucket', () => {
    expect(clientAddress(new Headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }))).toBe('198.51.100.1');
    expect(clientAddress(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientAddress(new Headers())).toBe('unknown');
  });

  it('derives the key from configuration without ever returning a configured secret verbatim', () => {
    expect(submitterSecret({ AAGEY_RATE_LIMIT_SECRET: 'explicit' })).toBe('explicit');
    const derived = submitterSecret({ SUPABASE_SECRET_KEY: 'sb_secret_example' });
    expect(derived).toMatch(/^[0-9a-f]{64}$/);
    expect(derived).not.toContain('sb_secret_example');
    expect(submitterSecret({})).toBe(submitterSecret({}));
  });

  it('local fallback log keeps only the current day and is bounded', () => {
    const log = createLocalSubmissionLog(2);
    log.record('h1', { companySlug: 'a', status: 's', createdAt: '2026-10-09T10:00:00.000Z' });
    log.record('h1', { companySlug: 'b', status: 's', createdAt: '2026-10-10T10:00:00.000Z' });
    expect(log.list('h1', startOfUtcDay(now)).map((r) => r.companySlug)).toEqual(['b']);
    log.record('h2', { companySlug: 'c', status: 's', createdAt: '2026-10-10T10:00:00.000Z' });
    log.record('h3', { companySlug: 'd', status: 's', createdAt: '2026-10-10T10:00:00.000Z' });
    expect(log.list('h1', startOfUtcDay(now))).toEqual([]); // evicted
  });
});

describe('readJsonBody', () => {
  const req = (body: BodyInit, headers: Record<string, string> = {}) =>
    new Request('http://localhost/x', { method: 'POST', body, headers, duplex: 'half' } as RequestInit);

  it('parses small JSON bodies', async () => {
    expect(await readJsonBody(req('{"a":1}'))).toEqual({ ok: true, value: { a: 1 } });
  });

  it('refuses a declared oversized body with 413 before reading it', async () => {
    const result = await readJsonBody(req('{}', { 'content-length': '999999' }), 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it('refuses an oversized streamed body even without a content-length', async () => {
    const big = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 10; i++) controller.enqueue(new TextEncoder().encode('x'.repeat(1000)));
        controller.close();
      },
    });
    const result = await readJsonBody(req(big), 4096);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it('returns 400 for malformed JSON or invalid UTF-8', async () => {
    for (const body of ['{nope', new Uint8Array([0x7b, 0xff, 0x7d])]) {
      const result = await readJsonBody(req(body));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(400);
    }
  });
});
