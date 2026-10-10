import { NextRequest } from 'next/server';
import { z } from 'zod';
import { produceActionPlan, generateAiActionPlan } from '@/lib/career/ai-plan';
import { aiLimiter, careerErrorResponse, getCareerContext, json } from '@/lib/career/context';
import { assessJobStability } from '@/lib/career/job-stability';
import { assessOfferRisk } from '@/lib/career/offer-risk';
import { loadOverview, aiPersonalisationAvailable } from '@/lib/career/overview';
import { actionPlanRequestSchema, jobStabilityInputSchema, offerRiskInputSchema } from '@/lib/career/schemas';
import { createPlanClient, type PlanClient } from '@/lib/ai/claude-planner';
import { getCompanySummary, slugify } from '@/lib/db/store';
import { readJsonBody } from '@/lib/http/body';
import { crossOriginResponse, isSameOrigin } from '@/lib/http/origin';
import { personalDataErrors } from '@/lib/privacy';

// An AI plan can take up to ~40 s (20 s timeout, one retry).
export const maxDuration = 60;

const requestSchema = z.object({ kind: z.enum(['offer_risk', 'job_stability', 'action_plan']), input: z.unknown().optional() });

let cachedClient: { key: string; client: PlanClient } | null = null;
const planClient = (apiKey: string) => {
  if (cachedClient?.key !== apiKey) cachedClient = { key: apiKey, client: createPlanClient(apiKey) };
  return cachedClient.client;
};

const invalid = (error: z.ZodError) => json({ error: 'Validation failed', details: error.flatten().fieldErrors }, { status: 400 });

/** Runs one assessment for the signed-in user, stores the snapshot, and returns it. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return crossOriginResponse();
  const auth = await getCareerContext();
  if (!auth.ok) return auth.response;
  const { user, repo } = auth.ctx;
  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const request = requestSchema.safeParse(body.value);
  if (!request.success) return invalid(request.error);

  try {
    switch (request.data.kind) {
      case 'offer_risk': {
        const parsed = offerRiskInputSchema.safeParse(request.data.input);
        if (!parsed.success) return invalid(parsed.error);
        const pii = personalDataErrors({ companyName: parsed.data.companyName });
        if (Object.keys(pii).length > 0) return json({ error: 'Please remove personal information before saving.', details: pii }, { status: 400 });

        // Company context is optional: a lookup failure must not block the offer-specific assessment.
        const company = parsed.data.companyName ? await getCompanySummary(slugify(parsed.data.companyName)).catch(() => null) : null;
        const result = assessOfferRisk(parsed.data, { company });
        return json({ assessment: await repo.saveAssessment('offer_risk', 'rules', parsed.data, result) }, { status: 201 });
      }

      case 'job_stability': {
        const parsed = jobStabilityInputSchema.safeParse(request.data.input);
        if (!parsed.success) return invalid(parsed.error);
        // Fill gaps from the saved profile so people do not re-enter the same facts.
        const profile = await repo.getProfile();
        const merged = {
          ...parsed.data,
          tenureMonths: parsed.data.tenureMonths ?? profile?.tenureMonths,
          runwayMonths: parsed.data.runwayMonths ?? profile?.financialRunwayMonths,
          noticePeriodDays: parsed.data.noticePeriodDays ?? profile?.noticePeriodDays,
        };
        const result = assessJobStability(merged);
        return json({ assessment: await repo.saveAssessment('job_stability', 'rules', merged, result) }, { status: 201 });
      }

      case 'action_plan': {
        const parsed = actionPlanRequestSchema.safeParse(request.data.input ?? {});
        if (!parsed.success) return invalid(parsed.error);
        const overview = await loadOverview(repo);
        if (!overview.profile) return json({ error: 'Save your career profile first so the plan can reflect your situation.' }, { status: 409 });

        const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
        const ctx = { profile: overview.profile, offerRisk: overview.offerRisk?.result, jobStability: overview.jobStability?.result };
        const outcome = await produceActionPlan(ctx, {
          useAi: parsed.data.useAi,
          generateWithAi: apiKey && aiPersonalisationAvailable() ? (c) => generateAiActionPlan(planClient(apiKey), c) : undefined,
          rateLimited: parsed.data.useAi ? !aiLimiter.tryConsume(`user:${user.id}`, Date.now()) : false,
          onAiError: (e) => console.error('[aagey] career plan AI failed; using the rules plan:', e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error'),
        });
        const assessment = await repo.saveAssessment('action_plan', outcome.source, parsed.data, outcome.plan);
        return json({ assessment: { ...assessment, completedTaskIds: [] }, source: outcome.source, fallbackReason: outcome.fallbackReason }, { status: 201 });
      }
    }
  } catch (error) {
    return careerErrorResponse(error, 'Failed to run the assessment');
  }
}
