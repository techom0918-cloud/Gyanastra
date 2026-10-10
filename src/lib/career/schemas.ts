// Validation for every Career Intelligence input. All free text is length-limited and checked for personal identifiers
// (see lib/privacy.ts) by the API routes before anything is stored or sent to a model.
import { z } from 'zod';
import { offerStatusSchema } from '@/lib/validation/schemas';
import { CAREER_STATUSES, FACTOR_KEYS, PRIORITY_KEYS } from './types';

const short = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  short(max)
    .optional()
    .transform((v) => (v ? v : undefined));
const tags = (maxItems: number, maxLen: number) =>
  z
    .array(short(maxLen).min(1))
    .max(maxItems)
    .default([])
    .transform((items) => {
      const seen = new Map<string, string>();
      for (const i of items) if (!seen.has(i.toLowerCase())) seen.set(i.toLowerCase(), i); // keep the first spelling
      return [...seen.values()];
    });

const months = z.number().int().min(0).max(600);

/** A calendar date as YYYY-MM-DD that really exists (so "2026-02-31" is rejected). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Enter a real date')
  .refine((s) => s >= '2000-01-01' && s <= '2100-12-31', 'Enter a date between 2000 and 2100');

const yesNoUnknown = z.enum(['yes', 'no', 'unknown']).default('unknown');
const factor = z.enum(FACTOR_KEYS);

export const careerProfileSchema = z
  .object({
    status: z.enum(CAREER_STATUSES),
    currentJobTitle: optionalText(100),
    targetRole: optionalText(100),
    industry: optionalText(100),
    experienceMonths: months.optional(),
    tenureMonths: months.optional(),
    skills: tags(20, 50),
    growthSkills: tags(10, 50),
    goals: optionalText(600),
    priorities: z.array(z.enum(PRIORITY_KEYS)).max(8).default([]),
    salaryMinLpa: z.number().min(0).max(1000).optional(),
    salaryMaxLpa: z.number().min(0).max(1000).optional(),
    preferredLocations: tags(10, 60),
    concerns: z.array(factor).max(8).default([]),
    exitReasons: z.array(factor).max(8).default([]),
    noticePeriodDays: z.number().int().min(0).max(365).optional(),
    financialRunwayMonths: z.number().min(0).max(120).optional(),
  })
  .refine((p) => p.salaryMinLpa === undefined || p.salaryMaxLpa === undefined || p.salaryMinLpa <= p.salaryMaxLpa, {
    path: ['salaryMaxLpa'],
    message: 'Maximum must be at least the minimum',
  })
  .refine((p) => p.experienceMonths === undefined || p.tenureMonths === undefined || p.tenureMonths <= p.experienceMonths, {
    path: ['tenureMonths'],
    message: 'Time in the current job cannot exceed total experience',
  })
  // Employment-only details are dropped for everyone else, so a student is never asked for (or stores) them.
  .transform((p) => (p.status === 'employed' ? p : { ...p, tenureMonths: undefined, noticePeriodDays: undefined }))
  // Unique, deduplicated enum lists.
  .transform((p) => ({ ...p, priorities: [...new Set(p.priorities)], concerns: [...new Set(p.concerns)], exitReasons: [...new Set(p.exitReasons)] }));

export const offerRiskInputSchema = z
  .object({
    companyName: optionalText(200),
    offerStage: offerStatusSchema,
    offerDate: isoDate.optional(),
    expectedJoiningDate: isoDate.optional(),
    lastCommunicationDate: isoDate.optional(),
    hasWrittenOffer: yesNoUnknown,
    joiningDateConfirmed: yesNoUnknown,
    recruiterResponsive: yesNoUnknown,
    hasBackup: yesNoUnknown,
  })
  .refine((o) => !o.offerDate || !o.expectedJoiningDate || o.expectedJoiningDate >= o.offerDate, {
    path: ['expectedJoiningDate'],
    message: 'Joining date cannot be before the offer date',
  });

const rating = z.number().int().min(1).max(5);

export const jobStabilityInputSchema = z.object({
  stage: z.enum(['considering', 'preparing', 'left']),
  tenureMonths: months.optional(),
  ratings: z
    .object(Object.fromEntries(FACTOR_KEYS.map((k) => [k, rating.optional()])) as Record<(typeof FACTOR_KEYS)[number], z.ZodOptional<typeof rating>>)
    .default({}),
  topPriority: factor.optional(),
  runwayMonths: z.number().min(0).max(120).optional(),
  noticePeriodDays: z.number().int().min(0).max(365).optional(),
  hasAlternativeOffer: yesNoUnknown,
  responsibilities: z.enum(['none', 'some', 'significant', 'unknown']).default('unknown'),
  monthsSinceLeaving: z.number().int().min(0).max(120).optional(),
});

export const actionPlanRequestSchema = z.object({
  /** Opt in to AI personalisation. Rule-based plans are always available. */
  useAi: z.boolean().default(false),
});

export const progressUpdateSchema = z.object({
  assessmentId: z.string().uuid(),
  taskId: z.string().regex(/^[a-z0-9-]{1,40}$/),
  done: z.boolean(),
});

export type CareerProfileInput = z.input<typeof careerProfileSchema>;
