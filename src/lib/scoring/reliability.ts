/**
 * Transparent Reliability Indicator — the Methodology page renders its formula from the constants below.
 *
 * 1. Basis: if a company has any real (non-demo) reports, only those are used; demo reports are used only
 *    when there is nothing else, and the result is flagged basis = 'demo'. The two are never mixed.
 * 2. Eligible: reports dated on or before `today` (future or invalid dates are excluded).
 * 3. Final outcomes only: Joining Confirmed is positive; Joining Delayed and Offer Revoked are negative.
 *    Offer Received and BG Verification Pending are in progress: counted and shown, never scored.
 * 4. Weight per outcome = recency × severity × day-cap share
 *      recency  = 1.5 if reported within the last 183 days, else 0.7
 *      severity = 2 for Offer Revoked, 1 otherwise (a revocation counts once, but twice as heavily)
 *      day cap  = community reports for one company on one day share at most 3 units of weight
 *                 (a revocation uses 2 units); verified and public sources are not capped
 * 5. score = 100 × (P + 2.5) / (P + N + 5), where P and N are the weighted positive and negative sums.
 *    The +2.5 / +5 prior acts like five neutral reports: small samples stay near 50 and the pull fades smoothly.
 * 6. No score (null, "Insufficient Data") with fewer than 3 scored outcomes.
 *
 * Evidence level (verified / public-unverified / community) does not change the score; it is reported
 * alongside it and limits confidence: without at least one verified outcome, confidence is at most "medium".
 * The score summarises reports. It is not a probability that any individual offer will be honoured.
 */
import { OfferReport, OfferStatus, ReliabilityIndicator } from '@/types';

export const POSITIVE_OUTCOMES: OfferStatus[] = ['joining_confirmed'];
export const NEGATIVE_OUTCOMES: OfferStatus[] = ['joining_delayed', 'offer_revoked'];
export const IN_PROGRESS_STATUSES: OfferStatus[] = ['offer_received', 'bg_verification_pending'];

export const RECENT_DAYS = 183;
export const RECENT_WEIGHT = 1.5;
export const OLDER_WEIGHT = 0.7;
export const REVOCATION_SEVERITY = 2;
export const PRIOR_POSITIVE = 2.5;
export const PRIOR_TOTAL = 5;
export const MIN_SCORED_OUTCOMES = 3;
export const DAILY_COMMUNITY_CAP = 3;
/** Effective (recency- and cap-weighted) outcome counts at which confidence becomes medium / high. */
export const MEDIUM_CONFIDENCE_WEIGHT = 5;
export const HIGH_CONFIDENCE_WEIGHT = 15;

export const LABEL_THRESHOLDS = { caution: 40, mixed: 60, mostlyPositive: 80 } as const;

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in UTC as YYYY-MM-DD (the server's time zone never matters). */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Days from `date` to `today`, both YYYY-MM-DD, computed in UTC. Null for malformed or impossible dates. */
export function ageInDays(date: string, today: string): number | null {
  const day = date.slice(0, 10);
  if (!ISO_DATE.test(day) || !ISO_DATE.test(today)) return null;
  const d = Date.parse(`${day}T00:00:00Z`);
  const t = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(d) || Number.isNaN(t) || new Date(d).toISOString().slice(0, 10) !== day) return null;
  return Math.round((t - d) / DAY_MS);
}

function severityOf(status: OfferStatus): number {
  return status === 'offer_revoked' ? REVOCATION_SEVERITY : 1;
}

export function labelForScore(score: number | null): ReliabilityIndicator['label'] {
  if (score === null) return 'Insufficient Data';
  if (score < LABEL_THRESHOLDS.caution) return 'Caution Advised';
  if (score < LABEL_THRESHOLDS.mixed) return 'Mixed Reports';
  if (score < LABEL_THRESHOLDS.mostlyPositive) return 'Mostly Positive';
  return 'Highly Positive';
}

export interface ScoringOptions {
  /** YYYY-MM-DD; defaults to the current UTC date. Pass it explicitly for deterministic results. */
  today?: string;
}

export function computeReliabilityIndicator(reports: OfferReport[], options: ScoringOptions = {}): ReliabilityIndicator {
  const today = options.today ?? utcToday();
  const real = reports.filter((r) => !r.isDemo);
  const demo = reports.filter((r) => r.isDemo);
  const basis: ReliabilityIndicator['basis'] = real.length > 0 ? 'real' : demo.length > 0 ? 'demo' : 'none';
  const used = basis === 'demo' ? demo : real;

  let futureOrInvalidDate = 0;
  let inProgressReports = 0;
  const outcomes: { report: OfferReport; recent: boolean }[] = [];
  for (const report of used) {
    const age = ageInDays(report.reportedAt, today);
    if (age === null || age < 0) {
      futureOrInvalidDate++;
    } else if (IN_PROGRESS_STATUSES.includes(report.status)) {
      inProgressReports++;
    } else {
      outcomes.push({ report, recent: age <= RECENT_DAYS });
    }
  }

  // Daily cap: community reports for this company on one day share at most DAILY_COMMUNITY_CAP units of weight,
  // where a revocation is REVOCATION_SEVERITY units. Sharing by severity units (not report count) keeps the
  // score monotonic: adding a negative report can never raise it, adding a positive one can never lower it.
  const communityUnitsPerDay = new Map<string, number>();
  for (const { report } of outcomes) {
    if (report.sourceType === 'community') {
      const day = report.reportedAt.slice(0, 10);
      communityUnitsPerDay.set(day, (communityUnitsPerDay.get(day) ?? 0) + severityOf(report.status));
    }
  }

  let positive = 0;
  let negative = 0;
  let effectiveCount = 0;
  let burstCappedReports = 0;
  const counts = { confirmed: 0, delayed: 0, revoked: 0 };
  const evidence = { verified: 0, publicUnverified: 0, community: 0 };
  let recentOutcomes = 0;

  for (const { report, recent } of outcomes) {
    let share = 1;
    if (report.sourceType === 'community') {
      const dayUnits = communityUnitsPerDay.get(report.reportedAt.slice(0, 10))!;
      if (dayUnits > DAILY_COMMUNITY_CAP) {
        share = DAILY_COMMUNITY_CAP / dayUnits;
        burstCappedReports++;
      }
    }
    const weight = (recent ? RECENT_WEIGHT : OLDER_WEIGHT) * share;
    effectiveCount += weight;
    if (recent) recentOutcomes++;

    if (report.status === 'joining_confirmed') {
      counts.confirmed++;
      positive += weight;
    } else {
      if (report.status === 'offer_revoked') counts.revoked++;
      else counts.delayed++;
      negative += weight * severityOf(report.status);
    }

    if (report.sourceType === 'verified') evidence.verified++;
    else if (report.sourceType === 'public') evidence.publicUnverified++;
    else evidence.community++;
  }

  const scoredOutcomes = outcomes.length;
  const score =
    scoredOutcomes >= MIN_SCORED_OUTCOMES
      ? Math.round((100 * (positive + PRIOR_POSITIVE)) / (positive + negative + PRIOR_TOTAL))
      : null;

  let confidence: ReliabilityIndicator['confidence'];
  if (score === null) confidence = 'insufficient';
  else if (effectiveCount < MEDIUM_CONFIDENCE_WEIGHT) confidence = 'low';
  else if (effectiveCount < HIGH_CONFIDENCE_WEIGHT || evidence.verified === 0) confidence = 'medium';
  else confidence = 'high';

  const indicator: ReliabilityIndicator = {
    label: labelForScore(score),
    score,
    confidence,
    basis,
    totalReports: reports.length,
    scoredOutcomes,
    recentOutcomes,
    inProgressReports,
    outcomes: counts,
    evidence,
    excluded: { demo: basis === 'real' ? demo.length : 0, futureOrInvalidDate },
    burstCappedReports,
    weightedPositiveShare: positive + negative > 0 ? Math.round((positive / (positive + negative)) * 100) / 100 : null,
    explanation: '',
  };
  indicator.explanation = explain(indicator);
  return indicator;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function explain(i: ReliabilityIndicator): string {
  if (i.basis === 'none') return 'No reports available. Absence of reports does not indicate reliability.';

  const parts: string[] = [];
  if (i.basis === 'demo') parts.push('DEMO DATA ONLY: this uses synthetic seed records, not real reports.');
  parts.push(
    `Scored on ${plural(i.scoredOutcomes, 'final outcome')} (${i.outcomes.confirmed} confirmed, ${i.outcomes.delayed} delayed, ` +
      `${i.outcomes.revoked} revoked; ${i.recentOutcomes} in the last ${RECENT_DAYS} days).`
  );
  if (i.inProgressReports > 0) parts.push(`${plural(i.inProgressReports, 'in-progress report')} (offer received or BG pending) not scored.`);
  if (i.scoredOutcomes > 0) {
    parts.push(
      `Evidence: ${i.evidence.verified} verified, ${i.evidence.publicUnverified} public but unverified, ${i.evidence.community} community self-reported.`
    );
  }
  if (i.excluded.demo > 0) parts.push(`${plural(i.excluded.demo, 'demo record')} excluded.`);
  if (i.excluded.futureOrInvalidDate > 0) parts.push(`${plural(i.excluded.futureOrInvalidDate, 'report')} with a future or invalid date excluded.`);
  if (i.burstCappedReports > 0) parts.push(`${plural(i.burstCappedReports, 'same-day community report')} down-weighted by the daily cap.`);
  if (i.score === null) parts.push(`At least ${MIN_SCORED_OUTCOMES} final outcomes are needed for a score.`);
  else if (i.confidence === 'low') parts.push('Small sample — treat with caution.');
  parts.push('This summarises reports; it is not a validated probability that any individual offer will be honoured.');
  return parts.join(' ');
}
