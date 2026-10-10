// Aagey AI — Core Type Definitions

export type OfferStatus =
  | 'offer_received'
  | 'bg_verification_pending'
  | 'joining_confirmed'
  | 'joining_delayed'
  | 'offer_revoked';

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  offer_received: 'Offer Received',
  bg_verification_pending: 'BG Verification Pending',
  joining_confirmed: 'Joining Confirmed',
  joining_delayed: 'Joining Delayed',
  offer_revoked: 'Offer Revoked',
};

export const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  offer_received: '#3b82f6',
  bg_verification_pending: '#f59e0b',
  joining_confirmed: '#22c55e',
  joining_delayed: '#f97316',
  offer_revoked: '#ef4444',
};

export interface OfferReport {
  id: string;
  companySlug: string;
  companyName: string;
  status: OfferStatus;
  description?: string;
  delayWeeks?: number;
  role?: string;
  graduationYear?: number;
  reportedAt: string; // ISO date
  sourceType: 'community' | 'verified' | 'public';
  isDemo?: boolean;
}

export interface Company {
  slug: string;
  name: string;
  sector?: string;
  reportCount: number;
  statusDistribution: Record<OfferStatus, number>;
  reliabilityIndicator: ReliabilityIndicator;
  latestReportDate?: string;
  oldestReportDate?: string;
}

export interface ReliabilityIndicator {
  label: 'Insufficient Data' | 'Caution Advised' | 'Mixed Reports' | 'Mostly Positive' | 'Highly Positive';
  score: number; // 0-100, shown only when enough data
  confidence: 'low' | 'medium' | 'high';
  totalReports: number;
  recentReports: number; // last 6 months
  positiveRate: number; // 0-1
  explanation: string;
}

export interface TrackedOffer {
  id: string;
  companySlug: string;
  companyName: string;
  role?: string;
  offerDate?: string;
  expectedJoiningDate?: string;
  lastCommunicationDate?: string;
  currentStatus: OfferStatus;
  notes?: string;
  alerts: Alert[];
  isDemo?: boolean;
}

export interface Alert {
  id: string;
  type: 'trend' | 'delay' | 'revocation' | 'info';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
  reportCount?: number;
  disclaimer: string;
}

export interface BackupPlan {
  id: string;
  userInput: BackupPlanInput;
  plan: GeneratedPlan;
  generatedAt: string;
  isAIGenerated: boolean;
}

export interface BackupPlanInput {
  skills: string[];
  degree: string;
  preferredRole: string;
  locationPreferences: string[];
  currentOfferStatus: OfferStatus;
  expectedJoiningDate?: string;
  companyName?: string;
  additionalContext?: string;
}

export interface GeneratedPlan {
  scenario: string;
  immediateActions: string[];
  weeklyGoals: WeeklyGoal[];
  skillsToImprove: SkillRecommendation[];
  applicationStrategy: string[];
  interviewPrep: string[];
  disclaimer: string;
}

export interface WeeklyGoal {
  week: number;
  goals: string[];
}

export interface SkillRecommendation {
  skill: string;
  reason: string;
  resources: string[];
}

export interface ClassificationResult {
  proposedStatus: OfferStatus;
  delayWeeks?: number;
  summary: string;
  confidence: number; // 0-1
}
