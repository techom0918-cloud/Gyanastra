import { z } from 'zod';

export const offerStatusSchema = z.enum([
  'offer_received',
  'bg_verification_pending',
  'joining_confirmed',
  'joining_delayed',
  'offer_revoked',
]);

export const reportSubmissionSchema = z.object({
  companyName: z.string().min(2, 'Company name is required').max(200),
  status: offerStatusSchema,
  description: z.string().max(1000).optional(),
  delayWeeks: z.number().min(0).max(200).optional(),
  role: z.string().max(200).optional(),
  graduationYear: z.number().int().min(2015).max(2030).optional(),
});

export const trackedOfferSchema = z.object({
  companyName: z.string().min(2).max(200),
  role: z.string().max(200).optional(),
  offerDate: z.string().optional(),
  expectedJoiningDate: z.string().optional(),
  lastCommunicationDate: z.string().optional(),
  currentStatus: offerStatusSchema,
  notes: z.string().max(1000).optional(),
});

// PATCH /api/tracker: only these fields may change; unknown keys are stripped.
export const trackedOfferUpdateSchema = trackedOfferSchema.partial();

export const backupPlanInputSchema = z.object({
  skills: z.array(z.string().max(100)).min(1, 'At least one skill required').max(20),
  degree: z.string().min(1, 'Degree is required').max(200),
  preferredRole: z.string().min(1, 'Preferred role is required').max(200),
  locationPreferences: z.array(z.string().max(100)).max(10).default([]),
  currentOfferStatus: offerStatusSchema,
  expectedJoiningDate: z.string().optional(),
  companyName: z.string().max(200).optional(),
  additionalContext: z.string().max(500).optional(),
});

export type ReportSubmission = z.infer<typeof reportSubmissionSchema>;
export type TrackedOfferInput = z.infer<typeof trackedOfferSchema>;
export type TrackedOfferUpdate = z.infer<typeof trackedOfferUpdateSchema>;
export type BackupPlanInputForm = z.infer<typeof backupPlanInputSchema>;
