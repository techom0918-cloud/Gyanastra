// Shared types for the Career Intelligence module (server and browser). Everything here is plain data.
import type { OfferStatus } from '@/types';

export const CAREER_STATUSES = ['student', 'offer_received', 'employed', 'seeking', 'other'] as const;
export type CareerStatus = (typeof CAREER_STATUSES)[number];

export const CAREER_STATUS_LABELS: Record<CareerStatus, string> = {
  student: 'Student',
  offer_received: 'Offer received',
  employed: 'Employed',
  seeking: 'Actively seeking',
  other: 'Other',
};

/** The factors users reason about when thinking about a job. Shared by profile concerns and the stability planner. */
export const FACTOR_KEYS = ['role_fit', 'learning_growth', 'compensation', 'work_environment', 'workload', 'job_security'] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

export const FACTOR_LABELS: Record<FactorKey, string> = {
  role_fit: 'Role fit',
  learning_growth: 'Learning and growth',
  compensation: 'Compensation',
  work_environment: 'Work environment',
  workload: 'Workload',
  job_security: 'Job security',
};

export const PRIORITY_KEYS = ['growth', 'learning', 'compensation', 'stability', 'work_life_balance', 'location', 'impact'] as const;
export type PriorityKey = (typeof PRIORITY_KEYS)[number];

export const PRIORITY_LABELS: Record<PriorityKey, string> = {
  growth: 'Career growth',
  learning: 'Learning',
  compensation: 'Compensation',
  stability: 'Stability',
  work_life_balance: 'Work-life balance',
  location: 'Location',
  impact: 'Meaningful impact',
};

export interface CareerProfile {
  status: CareerStatus;
  currentJobTitle?: string;
  targetRole?: string;
  industry?: string;
  experienceMonths?: number;
  /** Only meaningful (and only kept) when status is "employed". */
  tenureMonths?: number;
  skills: string[];
  growthSkills: string[];
  goals?: string;
  priorities: PriorityKey[];
  salaryMinLpa?: number;
  salaryMaxLpa?: number;
  preferredLocations: string[];
  concerns: FactorKey[];
  exitReasons: FactorKey[];
  /** Only kept when status is "employed". */
  noticePeriodDays?: number;
  financialRunwayMonths?: number;
  updatedAt?: string;
}

export type YesNoUnknown = 'yes' | 'no' | 'unknown';

/** What kind of statement an item is, so the UI never blurs facts, the user's own words, and our inferences. */
export type EvidenceType = 'reported_fact' | 'user_statement' | 'inference';

export interface EvidenceItem {
  type: EvidenceType;
  text: string;
  /** True when this item raises (rather than lowers or has no effect on) the level of concern. */
  concern?: boolean;
}

// --- Offer risk -----------------------------------------------------------------------------------------------------

export interface OfferRiskInput {
  companyName?: string;
  offerStage: OfferStatus;
  offerDate?: string;
  expectedJoiningDate?: string;
  lastCommunicationDate?: string;
  hasWrittenOffer: YesNoUnknown;
  joiningDateConfirmed: YesNoUnknown;
  recruiterResponsive: YesNoUnknown;
  hasBackup: YesNoUnknown;
}

export type OfferConcernLevel = 'insufficient_information' | 'no_specific_concerns' | 'some_open_questions' | 'needs_attention';

export interface OfferCompanyContext {
  matched: boolean;
  companyName?: string;
  /** Community reports exist for this company and are real (non-demo) data. */
  usedAsContext: boolean;
  summary: string;
}

export interface OfferRiskResult {
  kind: 'offer_risk';
  level: OfferConcernLevel;
  headline: string;
  evidence: EvidenceItem[];
  unknowns: string[];
  verify: string[];
  actions: string[];
  company: OfferCompanyContext | null;
  disclaimer: string;
}

// --- Job stability ----------------------------------------------------------------------------------------------------

export type ExitStage = 'considering' | 'preparing' | 'left';
export type Responsibilities = 'none' | 'some' | 'significant' | 'unknown';

export interface JobStabilityInput {
  stage: ExitStage;
  tenureMonths?: number;
  /** 1 (very poor) to 5 (very good); a missing key means "not sure". */
  ratings: Partial<Record<FactorKey, number>>;
  topPriority?: FactorKey;
  runwayMonths?: number;
  noticePeriodDays?: number;
  hasAlternativeOffer: YesNoUnknown;
  responsibilities: Responsibilities;
  monthsSinceLeaving?: number;
}

export type OptionId = 'stay_and_improve' | 'search_while_employed' | 'prepare_transition' | 'stabilise_and_search';
export type Emphasis = 'worth_exploring_first' | 'also_reasonable' | 'less_suited_right_now';

export interface StabilityOption {
  id: OptionId;
  title: string;
  emphasis: Emphasis;
  /** Why this emphasis, in terms of what the user told us. */
  why: string;
  considerations: string[];
  firstSteps: string[];
}

export interface FactorReading {
  key: FactorKey;
  label: string;
  rating?: number;
  reading: 'strength' | 'concern' | 'neutral' | 'unknown';
}

export interface PracticalNote {
  topic: string;
  note: string;
  concern?: boolean;
}

export interface JobStabilityResult {
  kind: 'job_stability';
  stage: ExitStage;
  headline: string;
  factors: FactorReading[];
  observations: EvidenceItem[];
  options: StabilityOption[];
  practical: PracticalNote[];
  unknowns: string[];
  disclaimer: string;
}

// --- Action plan --------------------------------------------------------------------------------------------------------

export type TaskCategory = 'skill' | 'application' | 'preparation' | 'financial' | 'verification' | 'reflection';

export interface PlanTask {
  /** Stable within one plan ("d30-1"); progress is stored against it. */
  id: string;
  title: string;
  why: string;
  category: TaskCategory;
  /** Where the task comes from: the user's profile, an earlier assessment, general practice, or an AI suggestion. */
  basis: 'profile' | 'assessment' | 'general' | 'ai_suggestion';
}

export interface PlanPhase {
  days: 30 | 60 | 90;
  goal: string;
  tasks: PlanTask[];
}

export interface ActionPlanResult {
  kind: 'action_plan';
  summary: string;
  phases: PlanPhase[];
  disclaimer: string;
}

export type CareerAssessmentResult = OfferRiskResult | JobStabilityResult | ActionPlanResult;
export type AssessmentKind = CareerAssessmentResult['kind'];

export interface StoredAssessment<R extends CareerAssessmentResult = CareerAssessmentResult> {
  id: string;
  kind: R['kind'];
  source: 'rules' | 'ai';
  createdAt: string;
  result: R;
  /** Present on action plans: ids of completed tasks. */
  completedTaskIds?: string[];
}

export interface CareerOverview {
  profile: CareerProfile | null;
  offerRisk: StoredAssessment<OfferRiskResult> | null;
  jobStability: StoredAssessment<JobStabilityResult> | null;
  actionPlan: StoredAssessment<ActionPlanResult> | null;
  /** Whether the optional AI personalisation of action plans is available on this server. */
  aiAvailable: boolean;
}
