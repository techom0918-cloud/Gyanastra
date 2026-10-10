import { afterEach, describe, expect, it } from 'vitest';
import { OfferReport, OfferStatus } from '@/types';
import {
  ageInDays,
  computeReliabilityIndicator,
  DAILY_COMMUNITY_CAP,
  labelForScore,
  RECENT_DAYS,
} from '@/lib/scoring/reliability';

const TODAY = '2026-10-10';
const opts = { today: TODAY };

function daysBefore(n: number, today = TODAY): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}

let seq = 0;
function report(status: OfferStatus, overrides: Partial<OfferReport> = {}): OfferReport {
  seq++;
  return {
    id: `r${seq}`,
    companySlug: 'acme',
    companyName: 'Acme',
    status,
    // Distinct days by default so the daily community cap does not interfere unless a test wants it.
    reportedAt: daysBefore(10 + (seq % 150)),
    sourceType: 'community',
    isDemo: false,
    ...overrides,
  };
}
const many = (n: number, status: OfferStatus, overrides: Partial<OfferReport> = {}) =>
  Array.from({ length: n }, () => report(status, overrides));

const score = (reports: OfferReport[]) => computeReliabilityIndicator(reports, opts).score;

describe('empty and sparse data', () => {
  it('has no score, basis "none" and insufficient confidence with no reports', () => {
    const r = computeReliabilityIndicator([], opts);
    expect(r).toMatchObject({ score: null, label: 'Insufficient Data', confidence: 'insufficient', basis: 'none', totalReports: 0 });
    expect(r.weightedPositiveShare).toBeNull();
  });

  it('returns null (not 0) below 3 final outcomes, and a number from 3', () => {
    expect(score(many(2, 'offer_revoked'))).toBeNull();
    expect(score(many(3, 'offer_revoked'))).toEqual(expect.any(Number));
  });

  it('never scores in-progress statuses, however many there are', () => {
    const r = computeReliabilityIndicator([...many(10, 'offer_received'), ...many(10, 'bg_verification_pending')], opts);
    expect(r).toMatchObject({ score: null, label: 'Insufficient Data', inProgressReports: 20, scoredOutcomes: 0 });
  });

  it('ignores in-progress reports when scoring final outcomes', () => {
    const outcomes = [...many(2, 'joining_confirmed'), report('joining_delayed')];
    expect(score([...outcomes, ...many(20, 'offer_received')])).toBe(score(outcomes));
  });
});

describe('formula', () => {
  it('matches 100 × (P + 2.5) / (P + N + 5) with recency 1.5 and revocation severity 2', () => {
    const recent = { reportedAt: daysBefore(30) };
    // 3 recent confirmed on one day (exactly at the cap): P = 4.5, N = 0 → 700 / 9.5 = 73.7
    expect(score(many(3, 'joining_confirmed', recent))).toBe(74);
    // 3 recent delayed: N = 4.5 → 250 / 9.5 = 26.3
    expect(score(many(3, 'joining_delayed', { reportedAt: daysBefore(31) }))).toBe(26);
    // 3 recent revoked on different days: N = 9 → 250 / 14 = 17.9
    expect(score([30, 31, 32].map((d) => report('offer_revoked', { reportedAt: daysBefore(d) })))).toBe(18);
  });

  it('weights older outcomes at 0.7', () => {
    const old = [400, 401, 402].map((d) => report('joining_confirmed', { reportedAt: daysBefore(d) }));
    // P = 2.1 → 460 / 7.1 = 64.8
    expect(score(old)).toBe(65);
  });

  it('pulls small samples toward 50 smoothly, with no jump at any report count', () => {
    const scores = [3, 4, 5, 6, 7, 8, 9, 10, 20].map((n) => score(many(n, 'joining_confirmed'))!);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    // The old formula jumped 90 → 100 between 4 and 5 reports; the prior never moves more than a few points per report.
    const jumps = scores.slice(1, 8).map((s, i) => s - scores[i]);
    expect(Math.max(...jumps)).toBeLessThanOrEqual(3);
    expect(scores[scores.length - 1]).toBeLessThan(100);
  });

  it('makes revocations proportional to the number of outcomes (no fixed penalty)', () => {
    const big = score([...many(200, 'joining_confirmed'), ...many(3, 'offer_revoked')])!;
    const small = score([...many(20, 'joining_confirmed'), ...many(3, 'offer_revoked')])!;
    expect(big).toBeGreaterThan(90);
    expect(big).toBeGreaterThan(small);
    // Revocations weigh more than delays, counted once.
    expect(score([...many(5, 'joining_confirmed'), ...many(3, 'offer_revoked')])!).toBeLessThan(
      score([...many(5, 'joining_confirmed'), ...many(3, 'joining_delayed')])!
    );
  });

  it('keeps every score strictly within 0–100 and monotonic in each new outcome', () => {
    // Deterministic pseudo-random datasets (mulberry32).
    let s = 42;
    const rand = () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const statuses: OfferStatus[] = ['joining_confirmed', 'joining_delayed', 'offer_revoked', 'offer_received'];
    const sources: OfferReport['sourceType'][] = ['community', 'community', 'public', 'verified'];
    const randomReport = (overrides: Partial<OfferReport> = {}) =>
      report(statuses[Math.floor(rand() * statuses.length)], {
        reportedAt: daysBefore(Math.floor(rand() * 5) * 100), // few distinct days, so the daily cap is exercised
        sourceType: sources[Math.floor(rand() * sources.length)],
        ...overrides,
      });

    for (let trial = 0; trial < 300; trial++) {
      const base = Array.from({ length: 3 + Math.floor(rand() * 25) }, () => randomReport());
      const before = computeReliabilityIndicator(base, opts);
      if (before.score !== null) {
        expect(before.score).toBeGreaterThan(0);
        expect(before.score).toBeLessThan(100);
      }
      const day = base[Math.floor(rand() * base.length)].reportedAt;
      const sourceType = sources[Math.floor(rand() * sources.length)];
      const plus = score([...base, report('joining_confirmed', { reportedAt: day, sourceType })]);
      const minusDelay = score([...base, report('joining_delayed', { reportedAt: day, sourceType })]);
      const minusRevoke = score([...base, report('offer_revoked', { reportedAt: day, sourceType })]);
      if (before.score !== null) {
        expect(plus!).toBeGreaterThanOrEqual(before.score);
        expect(minusDelay!).toBeLessThanOrEqual(before.score);
        expect(minusRevoke!).toBeLessThanOrEqual(before.score);
      }
    }
  });
});

describe('dates', () => {
  it(`treats exactly ${RECENT_DAYS} days as recent and ${RECENT_DAYS + 1} as older`, () => {
    const at = (d: number) => computeReliabilityIndicator(many(3, 'joining_confirmed', { reportedAt: daysBefore(d) }), opts);
    expect(at(RECENT_DAYS).recentOutcomes).toBe(3);
    expect(at(RECENT_DAYS + 1).recentOutcomes).toBe(0);
  });

  it('excludes future-dated and invalid dates, and reports them', () => {
    const valid = many(3, 'joining_confirmed');
    const r = computeReliabilityIndicator(
      [...valid, report('offer_revoked', { reportedAt: '2026-10-11' }), report('offer_revoked', { reportedAt: '2026-02-30' }), report('offer_revoked', { reportedAt: 'soon' })],
      opts
    );
    expect(r.excluded.futureOrInvalidDate).toBe(3);
    expect(r.score).toBe(score(valid));
  });

  it('gives identical results in any server time zone', () => {
    const data = [...many(4, 'joining_confirmed', { reportedAt: daysBefore(RECENT_DAYS) }), ...many(3, 'joining_delayed', { reportedAt: daysBefore(RECENT_DAYS + 1) })];
    const results = ['Asia/Kolkata', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati'].map((tz) => {
      process.env.TZ = tz;
      return computeReliabilityIndicator(data, opts);
    });
    for (const r of results) expect(r).toEqual(results[0]);
  });

  it('computes ages in UTC days and rejects malformed or impossible dates', () => {
    expect(ageInDays('2026-10-10', TODAY)).toBe(0);
    expect(ageInDays('2026-04-10', TODAY)).toBe(183);
    expect(ageInDays('2026-10-10T23:59:59Z', TODAY)).toBe(0);
    expect(ageInDays('2026-02-30', TODAY)).toBeNull();
    expect(ageInDays('10/10/2026', TODAY)).toBeNull();
  });

  afterEach(() => {
    delete process.env.TZ;
  });
});

describe('demo data', () => {
  it('excludes demo reports whenever real reports exist, and never mixes them', () => {
    const real = many(3, 'joining_confirmed');
    const demo = many(6, 'offer_revoked', { isDemo: true });
    const r = computeReliabilityIndicator([...real, ...demo], opts);
    expect(r).toMatchObject({ basis: 'real', score: score(real), excluded: { demo: 6, futureOrInvalidDate: 0 }, totalReports: 9 });
  });

  it('does not fall back to demo outcomes when the real reports are all in progress', () => {
    const r = computeReliabilityIndicator([report('offer_received'), ...many(6, 'joining_confirmed', { isDemo: true })], opts);
    expect(r).toMatchObject({ basis: 'real', score: null, excluded: { demo: 6, futureOrInvalidDate: 0 } });
  });

  it('labels a demo-only score as demo data', () => {
    const r = computeReliabilityIndicator(many(4, 'joining_confirmed', { isDemo: true }), opts);
    expect(r.basis).toBe('demo');
    expect(r.score).toEqual(expect.any(Number));
    expect(r.explanation).toMatch(/^DEMO DATA ONLY/);
  });
});

describe('evidence and verification', () => {
  it('counts evidence levels without changing the score', () => {
    const verified = many(4, 'joining_confirmed', { sourceType: 'verified' });
    const community = many(4, 'joining_confirmed');
    const r = computeReliabilityIndicator([...verified, ...many(2, 'joining_delayed', { sourceType: 'public' }), report('offer_revoked')], opts);
    expect(r.evidence).toEqual({ verified: 4, publicUnverified: 2, community: 1 });
    expect(score(verified)).toBe(score(community));
  });

  it('caps confidence at medium without any verified outcome', () => {
    const community = many(30, 'joining_confirmed');
    expect(computeReliabilityIndicator(community, opts).confidence).toBe('medium');
    expect(computeReliabilityIndicator([...community, report('joining_confirmed', { sourceType: 'verified' })], opts).confidence).toBe('high');
  });

  it('bases confidence on effective weight, not raw count: 15 old outcomes are only "medium"', () => {
    const old = Array.from({ length: 15 }, (_, i) => report('joining_confirmed', { reportedAt: daysBefore(400 + i), sourceType: 'verified' }));
    expect(computeReliabilityIndicator(old, opts).confidence).toBe('medium'); // 15 × 0.7 = 10.5 < 15
    expect(computeReliabilityIndicator(old.slice(0, 4), opts).confidence).toBe('low'); // 2.8 < 5
  });
});

describe('daily community cap (manipulation resistance)', () => {
  const history = [
    ...[60, 61, 62].map((d) => report('joining_confirmed', { reportedAt: daysBefore(d) })),
    ...[63, 64].map((d) => report('joining_delayed', { reportedAt: daysBefore(d) })),
  ];

  it('limits how far a same-day burst of anonymous posts can move the score', () => {
    const before = score(history)!;
    const burst = (n: number) => score([...history, ...many(n, 'offer_revoked', { reportedAt: TODAY })])!;
    // 3 posts or 300 posts on one day have the same effect: at most 3 units of weight.
    expect(burst(3)).toBe(burst(300));
    expect(before - burst(300)).toBeLessThan(30);
    expect(burst(300)).toBeGreaterThan(0);
  });

  it('shares the cap across the day, so legitimate same-day reports keep a proportional voice', () => {
    const r = computeReliabilityIndicator([...history, ...many(DAILY_COMMUNITY_CAP + 3, 'joining_confirmed', { reportedAt: TODAY })], opts);
    expect(r.burstCappedReports).toBe(DAILY_COMMUNITY_CAP + 3);
    expect(r.explanation).toContain('daily cap');
  });

  it('never caps verified or public sources', () => {
    const sameDay = (sourceType: OfferReport['sourceType']) => score(many(10, 'offer_revoked', { reportedAt: daysBefore(5), sourceType }))!;
    expect(sameDay('verified')).toBeLessThan(sameDay('community'));
    expect(sameDay('public')).toBe(sameDay('verified'));
  });
});

describe('labels', () => {
  it('uses the documented thresholds', () => {
    expect(labelForScore(null)).toBe('Insufficient Data');
    expect(labelForScore(39)).toBe('Caution Advised');
    expect(labelForScore(40)).toBe('Mixed Reports');
    expect(labelForScore(59)).toBe('Mixed Reports');
    expect(labelForScore(60)).toBe('Mostly Positive');
    expect(labelForScore(79)).toBe('Mostly Positive');
    expect(labelForScore(80)).toBe('Highly Positive');
  });

  it('never calls the score a probability, and says when the sample is small', () => {
    const r = computeReliabilityIndicator(many(3, 'joining_confirmed'), opts);
    expect(r.confidence).toBe('low');
    expect(r.explanation).toContain('not a validated probability');
    expect(r.explanation).toContain('Small sample');
    expect(r.weightedPositiveShare).toBe(1);
  });
});
