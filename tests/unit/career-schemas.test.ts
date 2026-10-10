import { describe, expect, it } from 'vitest';
import { careerProfileSchema, isoDate, jobStabilityInputSchema, offerRiskInputSchema, progressUpdateSchema } from '@/lib/career/schemas';

describe('careerProfileSchema', () => {
  it('accepts a student with only a status (nothing employment-related is required)', () => {
    const r = careerProfileSchema.safeParse({ status: 'student' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ status: 'student', skills: [], growthSkills: [], priorities: [], concerns: [] });
  });

  it('rejects an unknown status and out-of-range numbers', () => {
    expect(careerProfileSchema.safeParse({ status: 'wizard' }).success).toBe(false);
    expect(careerProfileSchema.safeParse({ status: 'employed', tenureMonths: -1 }).success).toBe(false);
    expect(careerProfileSchema.safeParse({ status: 'employed', noticePeriodDays: 400 }).success).toBe(false);
    expect(careerProfileSchema.safeParse({ status: 'seeking', financialRunwayMonths: 500 }).success).toBe(false);
  });

  it('drops employment-only details for people who are not employed', () => {
    const r = careerProfileSchema.parse({ status: 'student', tenureMonths: 6, noticePeriodDays: 30, financialRunwayMonths: 4 });
    expect(r.tenureMonths).toBeUndefined();
    expect(r.noticePeriodDays).toBeUndefined();
    expect(r.financialRunwayMonths).toBe(4); // runway is useful to anyone
  });

  it('keeps tenure and notice period for employed users', () => {
    const r = careerProfileSchema.parse({ status: 'employed', experienceMonths: 18, tenureMonths: 6, noticePeriodDays: 60 });
    expect(r).toMatchObject({ tenureMonths: 6, noticePeriodDays: 60 });
  });

  it('rejects tenure longer than total experience and an inverted salary range', () => {
    const tenure = careerProfileSchema.safeParse({ status: 'employed', experienceMonths: 6, tenureMonths: 12 });
    expect(tenure.success).toBe(false);
    const salary = careerProfileSchema.safeParse({ status: 'seeking', salaryMinLpa: 12, salaryMaxLpa: 8 });
    expect(salary.success).toBe(false);
  });

  it('trims text, drops empty strings, de-duplicates tags and enum lists, and caps list sizes', () => {
    const r = careerProfileSchema.parse({ status: 'seeking', targetRole: '  Data Analyst ', industry: '   ', skills: ['SQL', 'sql', ' Python '], priorities: ['growth', 'growth'] });
    expect(r.targetRole).toBe('Data Analyst');
    expect(r.industry).toBeUndefined();
    expect(r.skills).toEqual(['SQL', 'Python']);
    expect(r.priorities).toEqual(['growth']);
    expect(careerProfileSchema.safeParse({ status: 'seeking', skills: Array.from({ length: 21 }, (_, i) => `s${i}`) }).success).toBe(false);
    expect(careerProfileSchema.safeParse({ status: 'seeking', goals: 'x'.repeat(601) }).success).toBe(false);
  });

  it('strips unknown keys such as a client-supplied user id', () => {
    const r = careerProfileSchema.parse({ status: 'student', userId: 'someone-else', user_id: 'someone-else' });
    expect(r).not.toHaveProperty('userId');
    expect(r).not.toHaveProperty('user_id');
  });
});

describe('dates and assessment inputs', () => {
  it('only accepts real calendar dates', () => {
    expect(isoDate.safeParse('2026-10-10').success).toBe(true);
    expect(isoDate.safeParse('2026-02-31').success).toBe(false);
    expect(isoDate.safeParse('10/10/2026').success).toBe(false);
    expect(isoDate.safeParse('1999-01-01').success).toBe(false);
  });

  it('defaults unanswered offer questions to "unknown" and checks date order', () => {
    const r = offerRiskInputSchema.parse({ offerStage: 'offer_received' });
    expect(r).toMatchObject({ hasWrittenOffer: 'unknown', joiningDateConfirmed: 'unknown', recruiterResponsive: 'unknown', hasBackup: 'unknown' });
    expect(offerRiskInputSchema.safeParse({ offerStage: 'offer_received', offerDate: '2026-09-01', expectedJoiningDate: '2026-08-01' }).success).toBe(false);
  });

  it('validates job-stability ratings as 1 to 5 and the stage', () => {
    expect(jobStabilityInputSchema.safeParse({ stage: 'considering', ratings: { compensation: 2, workload: 5 } }).success).toBe(true);
    expect(jobStabilityInputSchema.safeParse({ stage: 'considering', ratings: { compensation: 6 } }).success).toBe(false);
    expect(jobStabilityInputSchema.safeParse({ stage: 'quitting' }).success).toBe(false);
  });

  it('requires a UUID assessment id for progress updates', () => {
    expect(progressUpdateSchema.safeParse({ assessmentId: 'nope', taskId: 'd30-1', done: true }).success).toBe(false);
    expect(progressUpdateSchema.safeParse({ assessmentId: '11111111-1111-4111-8111-111111111111', taskId: 'd30-1', done: true }).success).toBe(true);
    expect(progressUpdateSchema.safeParse({ assessmentId: '11111111-1111-4111-8111-111111111111', taskId: "d30-1'; drop", done: true }).success).toBe(false);
  });
});
