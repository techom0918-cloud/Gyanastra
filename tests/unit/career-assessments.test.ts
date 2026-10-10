import { describe, expect, it, vi } from 'vitest';
import { generateRulesPlan } from '@/lib/career/action-plan';
import { buildCareerPrompt, normalizeModelPlan, produceActionPlan } from '@/lib/career/ai-plan';
import { assessJobStability } from '@/lib/career/job-stability';
import { assessOfferRisk } from '@/lib/career/offer-risk';
import type { CareerProfile, JobStabilityInput, OfferRiskInput } from '@/lib/career/types';
import type { Company, ReliabilityIndicator } from '@/types';

const NOW = new Date('2026-10-10T00:00:00Z');

const offer = (o: Partial<OfferRiskInput> = {}): OfferRiskInput => ({
  offerStage: 'offer_received',
  hasWrittenOffer: 'unknown',
  joiningDateConfirmed: 'unknown',
  recruiterResponsive: 'unknown',
  hasBackup: 'unknown',
  ...o,
});

function company(overrides: Partial<ReliabilityIndicator> = {}): Company {
  const ri: ReliabilityIndicator = {
    label: 'Mostly Positive',
    score: 70,
    confidence: 'high',
    basis: 'real',
    totalReports: 12,
    scoredOutcomes: 10,
    recentOutcomes: 8,
    inProgressReports: 2,
    outcomes: { confirmed: 8, delayed: 1, revoked: 1 },
    evidence: { verified: 0, publicUnverified: 0, community: 10 },
    excluded: { demo: 0, futureOrInvalidDate: 0 },
    burstCappedReports: 0,
    weightedPositiveShare: 0.8,
    explanation: '',
    ...overrides,
  };
  return { slug: 'acme', name: 'Acme', reportCount: 12, statusDistribution: { offer_received: 0, bg_verification_pending: 0, joining_confirmed: 8, joining_delayed: 1, offer_revoked: 1 }, reliabilityIndicator: ri };
}

describe('assessOfferRisk', () => {
  it('says there is not enough information when the key questions are unanswered', () => {
    const r = assessOfferRisk(offer(), { now: NOW });
    expect(r.level).toBe('insufficient_information');
    expect(r.unknowns.length).toBeGreaterThanOrEqual(3);
    expect(r.disclaimer).toMatch(/not a prediction/i);
  });

  it('reports no specific concerns only when the signals are answered and fine', () => {
    const r = assessOfferRisk(offer({ hasWrittenOffer: 'yes', joiningDateConfirmed: 'yes', recruiterResponsive: 'yes', hasBackup: 'yes', lastCommunicationDate: '2026-10-05', expectedJoiningDate: '2026-12-01' }), { now: NOW });
    expect(r.level).toBe('no_specific_concerns');
  });

  it('flags a missing written offer and an unconfirmed, near joining date', () => {
    const r = assessOfferRisk(offer({ hasWrittenOffer: 'no', joiningDateConfirmed: 'no', expectedJoiningDate: '2026-10-25' }), { now: NOW });
    expect(r.level).toBe('needs_attention');
    expect(r.verify.join(' ')).toMatch(/written offer letter/);
    expect(r.evidence.some((e) => e.type === 'user_statement' && e.concern)).toBe(true);
  });

  it('treats a long silence as an inference, not a fact about the employer', () => {
    const r = assessOfferRisk(offer({ hasWrittenOffer: 'yes', joiningDateConfirmed: 'yes', recruiterResponsive: 'yes', lastCommunicationDate: '2026-07-01' }), { now: NOW });
    const silence = r.evidence.find((e) => /days since the last contact/.test(e.text));
    expect(silence?.type).toBe('inference');
    expect(r.level).toBe('some_open_questions');
  });

  it('handles a revoked offer without inventing reasons', () => {
    const r = assessOfferRisk(offer({ offerStage: 'offer_revoked' }), { now: NOW });
    expect(r.level).toBe('needs_attention');
    expect(r.actions.join(' ')).toMatch(/in writing/);
    expect(JSON.stringify(r)).not.toMatch(/probab|percent|%/i);
  });

  it('notes a joining date that has already passed without confirmation', () => {
    const r = assessOfferRisk(offer({ expectedJoiningDate: '2026-09-01', hasWrittenOffer: 'yes', joiningDateConfirmed: 'yes', recruiterResponsive: 'yes' }), { now: NOW });
    expect(r.evidence.some((e) => e.type === 'inference' && /already passed/.test(e.text))).toBe(true);
  });

  describe('company context', () => {
    const answered = { hasWrittenOffer: 'yes', joiningDateConfirmed: 'yes', recruiterResponsive: 'yes', hasBackup: 'yes' } as const;

    it('uses real, well-supported community data as labelled context only', () => {
      const r = assessOfferRisk(offer({ ...answered, companyName: 'Acme' }), { company: company(), now: NOW });
      expect(r.company?.usedAsContext).toBe(true);
      expect(r.company?.summary).toMatch(/self-reported and unverified/);
      expect(r.evidence.some((e) => e.type === 'reported_fact')).toBe(true);
      expect(r.level).toBe('no_specific_concerns'); // positive company data never changes the level
    });

    it('lets a caution label add concern but never removes it', () => {
      const clean = assessOfferRisk(offer({ ...answered, companyName: 'Acme' }), { company: company({ label: 'Caution Advised' }), now: NOW });
      expect(clean.level).toBe('some_open_questions');
      const worse = assessOfferRisk(offer({ ...answered, hasWrittenOffer: 'no', companyName: 'Acme' }), { company: company({ label: 'Highly Positive' }), now: NOW });
      const withoutCompany = assessOfferRisk(offer({ ...answered, hasWrittenOffer: 'no' }), { now: NOW });
      expect(worse.level).toBe(withoutCompany.level);
    });

    it('ignores demo data and thin data, and says so', () => {
      const demo = assessOfferRisk(offer({ ...answered, companyName: 'Acme' }), { company: company({ basis: 'demo', label: 'Caution Advised' }), now: NOW });
      expect(demo.company?.usedAsContext).toBe(false);
      expect(demo.company?.summary).toMatch(/demonstration data/i);
      expect(demo.level).toBe('no_specific_concerns');

      const thin = assessOfferRisk(offer({ ...answered, companyName: 'Acme' }), { company: company({ scoredOutcomes: 2, confidence: 'low', label: 'Caution Advised' }), now: NOW });
      expect(thin.company?.usedAsContext).toBe(false);
      expect(thin.level).toBe('no_specific_concerns');
    });

    it('explains when the company is unknown to Aagey', () => {
      const r = assessOfferRisk(offer({ ...answered, companyName: 'Nowhere Ltd' }), { company: null, now: NOW });
      expect(r.company).toMatchObject({ matched: false, usedAsContext: false });
      expect(r.company?.summary).toMatch(/gap in the data/);
    });
  });
});

const stability = (s: Partial<JobStabilityInput> = {}): JobStabilityInput => ({ stage: 'considering', ratings: {}, hasAlternativeOffer: 'unknown', responsibilities: 'unknown', ...s });

describe('assessJobStability', () => {
  it('never labels the person or predicts leaving', () => {
    const r = assessJobStability(stability({ tenureMonths: 6, ratings: { compensation: 1, learning_growth: 2, role_fit: 2 } }));
    const text = JSON.stringify(r).toLowerCase();
    expect(text).not.toMatch(/unreliable|will resign|likely to (quit|leave)|flight risk|job-hopper/);
    expect(r.disclaimer).toMatch(/does not predict/i);
  });

  it('presents balanced options for someone around six months in', () => {
    const r = assessJobStability(stability({ tenureMonths: 6, ratings: { workload: 2, role_fit: 4 }, runwayMonths: 5, hasAlternativeOffer: 'no' }));
    expect(r.options.map((o) => o.id).sort()).toEqual(['prepare_transition', 'search_while_employed', 'stay_and_improve']);
    expect(r.observations.some((o) => o.type === 'inference' && /context, not a reason/.test(o.text))).toBe(true);
    expect(r.practical.some((p) => p.topic === 'Your agreement')).toBe(true); // checks bond / early-exit terms
    for (const o of r.options) expect(o.firstSteps.length).toBeGreaterThan(0);
  });

  it('leads with staying and improving when the issues look fixable', () => {
    const r = assessJobStability(stability({ tenureMonths: 7, ratings: { workload: 1, role_fit: 4, compensation: 4, job_security: 4 }, runwayMonths: 4 }));
    expect(r.options[0].id).toBe('stay_and_improve');
  });

  it('leans towards searching while employed when many factors are poor and there is no offer', () => {
    const r = assessJobStability(stability({ ratings: { compensation: 1, learning_growth: 1, role_fit: 2, work_environment: 2 }, runwayMonths: 2, hasAlternativeOffer: 'no' }));
    expect(r.options[0].id).toBe('search_while_employed');
    expect(r.options.find((o) => o.id === 'prepare_transition')?.emphasis).toBe('less_suited_right_now');
    expect(r.practical.find((p) => p.topic === 'Savings')?.concern).toBe(true);
  });

  it('puts a planned transition first when preparing to leave with an offer and a buffer', () => {
    const r = assessJobStability(stability({ stage: 'preparing', hasAlternativeOffer: 'yes', runwayMonths: 6, noticePeriodDays: 90, ratings: { compensation: 2, learning_growth: 2 } }));
    expect(r.options[0].id).toBe('prepare_transition');
    expect(r.practical.find((p) => p.topic === 'Notice period')?.concern).toBe(true);
    expect(r.practical.find((p) => p.topic === 'Alternative offer')?.note).toMatch(/in writing/);
  });

  it('offers a different set of options to someone who has already left', () => {
    const r = assessJobStability(stability({ stage: 'left', monthsSinceLeaving: 2, runwayMonths: 3 }));
    expect(r.options.map((o) => o.id)).toEqual(['stabilise_and_search', 'prepare_transition']);
    expect(r.options.some((o) => o.id === 'stay_and_improve')).toBe(false);
    expect(r.practical.some((p) => p.topic === 'Notice period')).toBe(false);
  });

  it('does not favour staying on tenure alone when nothing has been rated', () => {
    const r = assessJobStability(stability({ tenureMonths: 6 }));
    expect(r.options.every((o) => o.emphasis === 'also_reasonable')).toBe(true);
  });

  it('reports what is unknown instead of guessing', () => {
    const r = assessJobStability(stability());
    expect(r.factors.every((f) => f.reading === 'unknown')).toBe(true);
    expect(r.unknowns.join(' ')).toMatch(/savings/);
    expect(r.unknowns.join(' ')).toMatch(/notice period/);
    expect(r.options.every((o) => o.emphasis === 'also_reasonable')).toBe(true);
  });
});

const profile = (p: Partial<CareerProfile> = {}): CareerProfile => ({ status: 'student', skills: [], growthSkills: [], priorities: [], preferredLocations: [], concerns: [], exitReasons: [], ...p });

describe('generateRulesPlan', () => {
  it('returns three phases with unique stable task ids, each task explaining why', () => {
    const plan = generateRulesPlan({ profile: profile({ targetRole: 'Data Analyst', growthSkills: ['SQL', 'Tableau'], goals: 'Get a first analytics job' }) });
    expect(plan.phases.map((p) => p.days)).toEqual([30, 60, 90]);
    const ids = plan.phases.flatMap((p) => p.tasks.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^d(30|60|90)-\d+$/.test(id))).toBe(true);
    for (const t of plan.phases.flatMap((p) => p.tasks)) {
      expect(t.why.length).toBeGreaterThan(10);
      expect(t.basis).not.toBe('ai_suggestion');
    }
    expect(plan.phases[0].tasks.some((t) => t.basis === 'profile' && /SQL/.test(t.title))).toBe(true);
    expect(plan.disclaimer).toMatch(/no AI/);
  });

  it('ties tasks to the saved assessments for an employed person considering a move', () => {
    const jobStability = assessJobStability(stability({ ratings: { compensation: 1, learning_growth: 2 }, runwayMonths: 4 }));
    const plan = generateRulesPlan({ profile: profile({ status: 'employed', targetRole: 'Backend Engineer' }), jobStability });
    expect(plan.phases.flatMap((p) => p.tasks).some((t) => t.basis === 'assessment' && t.category === 'financial')).toBe(true);
    expect(plan.phases[2].tasks.some((t) => /Reassess/.test(t.title))).toBe(true);
  });

  it('adds verification tasks from an offer assessment', () => {
    const offerRisk = assessOfferRisk(offer({ hasWrittenOffer: 'no', joiningDateConfirmed: 'no' }), { now: NOW });
    const plan = generateRulesPlan({ profile: profile({ status: 'offer_received' }), offerRisk });
    expect(plan.phases[0].tasks.some((t) => t.category === 'verification' && t.basis === 'assessment')).toBe(true);
    expect(plan.phases[0].tasks.some((t) => /backup applications/i.test(t.title))).toBe(true);
  });

  it('still works for a bare profile', () => {
    const plan = generateRulesPlan({ profile: profile() });
    for (const phase of plan.phases) expect(phase.tasks.length).toBeGreaterThan(0);
  });
});

describe('AI personalisation', () => {
  const sensitive = profile({
    status: 'employed',
    targetRole: 'Backend Engineer',
    skills: ['Go'],
    growthSkills: ['Kubernetes'],
    goals: 'Grow into a staff role',
    salaryMinLpa: 31,
    salaryMaxLpa: 47,
    financialRunwayMonths: 7.5,
    noticePeriodDays: 83,
    exitReasons: ['compensation'],
    concerns: ['compensation'],
  });

  it('sends only an allow-listed, non-identifying summary', () => {
    const offerRisk = assessOfferRisk(offer({ companyName: 'SecretCorp', expectedJoiningDate: '2026-12-17', hasWrittenOffer: 'no' }), { now: NOW });
    const prompt = buildCareerPrompt({ profile: sensitive, offerRisk });
    expect(prompt).toContain('Backend Engineer');
    expect(prompt).toContain('Kubernetes');
    expect(prompt).toContain('<profile_summary>');
    for (const leaked of ['31', '47', '7.5', '83', 'SecretCorp', '2026-12-17', 'exit']) expect(prompt).not.toContain(leaked);
  });

  const valid = {
    summary: 'A plan.',
    phases: [30, 60, 90].map((days) => ({ days, goal: `Goal ${days}`, tasks: [{ title: `Task ${days}`, why: 'Because of your goal', category: 'skill' as const }] })),
  };

  it('normalises valid model output, assigning ids, marking it as an AI suggestion and enforcing limits', () => {
    const plan = normalizeModelPlan({ ...valid, phases: valid.phases.map((p) => ({ ...p, tasks: Array.from({ length: 9 }, (_, i) => ({ title: 'x'.repeat(500), why: `why ${i}`, category: 'skill' as const })) })) });
    expect(plan?.phases.every((p) => p.tasks.length === 4)).toBe(true);
    expect(plan?.phases[0].tasks[0]).toMatchObject({ id: 'd30-1', basis: 'ai_suggestion' });
    expect(plan?.phases[0].tasks[0].title.length).toBe(200);
    expect(plan?.disclaimer).toMatch(/AI model/);
  });

  it('rejects incomplete model output', () => {
    expect(normalizeModelPlan({ ...valid, phases: valid.phases.slice(0, 2) })).toBeNull();
    expect(normalizeModelPlan({ ...valid, summary: '   ' })).toBeNull();
    expect(normalizeModelPlan({ ...valid, phases: valid.phases.map((p) => ({ ...p, tasks: [{ title: ' ', why: ' ', category: 'skill' as const }] })) })).toBeNull();
  });

  describe('produceActionPlan fallback', () => {
    const ctx = { profile: sensitive };
    const ai = { kind: 'action_plan' as const, summary: 'AI', phases: generateRulesPlan(ctx).phases, disclaimer: 'ai' };

    it('uses the rules plan unless AI is requested', async () => {
      const generate = vi.fn(async () => ai);
      const r = await produceActionPlan(ctx, { useAi: false, generateWithAi: generate });
      expect(r).toMatchObject({ source: 'rules', fallbackReason: 'not_requested' });
      expect(generate).not.toHaveBeenCalled();
    });

    it('falls back when AI is not configured, rate limited, or failing', async () => {
      expect((await produceActionPlan(ctx, { useAi: true })).fallbackReason).toBe('not_configured');
      expect((await produceActionPlan(ctx, { useAi: true, generateWithAi: async () => ai, rateLimited: true })).fallbackReason).toBe('rate_limited');
      const onAiError = vi.fn();
      const failed = await produceActionPlan(ctx, { useAi: true, generateWithAi: async () => { throw new Error('boom'); }, onAiError });
      expect(failed).toMatchObject({ source: 'rules', fallbackReason: 'ai_unavailable' });
      expect(failed.plan.phases).toHaveLength(3);
      expect(onAiError).toHaveBeenCalledOnce();
    });

    it('returns the AI plan when it works', async () => {
      const r = await produceActionPlan(ctx, { useAi: true, generateWithAi: async () => ai });
      expect(r).toMatchObject({ source: 'ai' });
      expect(r.fallbackReason).toBeUndefined();
    });
  });
});
