import type { CareerRepository } from './repository';
import type { ActionPlanResult, CareerOverview, JobStabilityResult, OfferRiskResult, StoredAssessment } from './types';

export function aiPersonalisationAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function loadOverview(repo: CareerRepository): Promise<CareerOverview> {
  const [profile, assessments] = await Promise.all([repo.getProfile(), repo.latestAssessments()]);
  const pick = <R extends StoredAssessment['result']>(kind: R['kind']) => (assessments.find((a) => a.kind === kind) as StoredAssessment<R> | undefined) ?? null;
  return {
    profile,
    offerRisk: pick<OfferRiskResult>('offer_risk'),
    jobStability: pick<JobStabilityResult>('job_stability'),
    actionPlan: pick<ActionPlanResult>('action_plan'),
    aiAvailable: aiPersonalisationAvailable(),
  };
}
