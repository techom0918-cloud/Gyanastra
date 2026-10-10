/**
 * Transparent Reliability Indicator
 *
 * Formula:
 *   rawScore = (positiveReports / totalReports) * 100
 *
 *   Adjustments:
 *   - Recency weight: reports < 6 months old count 1.5x, older count 0.7x
 *   - Penalty: each revocation subtracts 15 points (capped at -45)
 *   - Small-sample damping: if totalReports < 5, score is pulled toward 50
 *     by factor (5 - count) / 5
 *
 *   finalScore = clamp(dampedScore, 0, 100)
 *
 * Confidence:
 *   - low: < 5 reports
 *   - medium: 5-14 reports
 *   - high: 15+ reports
 *
 * Labels:
 *   - Insufficient Data: < 3 reports
 *   - Caution Advised: score < 40
 *   - Mixed Reports: score 40-59
 *   - Mostly Positive: score 60-79
 *   - Highly Positive: score >= 80
 *
 * Limitations shown alongside every indicator:
 *   - Based on self-reported community data, not verified outcomes
 *   - Absence of negative reports ≠ proof of reliability
 *   - Small samples are explicitly flagged
 */

import { OfferReport, ReliabilityIndicator, OfferStatus } from '@/types';

const POSITIVE_STATUSES: OfferStatus[] = ['joining_confirmed', 'offer_received', 'bg_verification_pending'];
const NEGATIVE_STATUSES: OfferStatus[] = ['joining_delayed', 'offer_revoked'];
const RECENCY_MONTHS = 6;
const REVOCATION_PENALTY = 15;
const MAX_REVOCATION_PENALTY = 45;
const MIN_REPORTS_FOR_LABEL = 3;
const SMALL_SAMPLE_THRESHOLD = 5;

function monthsAgo(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

export function computeReliabilityIndicator(reports: OfferReport[]): ReliabilityIndicator {
  const total = reports.length;

  if (total === 0) {
    return {
      label: 'Insufficient Data',
      score: 0,
      confidence: 'low',
      totalReports: 0,
      recentReports: 0,
      positiveRate: 0,
      explanation: 'No reports available. Absence of reports does not indicate reliability.',
    };
  }

  // Weighted scoring
  let weightedPositive = 0;
  let weightedTotal = 0;
  let revocations = 0;
  let recentCount = 0;

  for (const r of reports) {
    const isRecent = monthsAgo(r.reportedAt) <= RECENCY_MONTHS;
    const weight = isRecent ? 1.5 : 0.7;

    if (isRecent) recentCount++;
    if (r.status === 'offer_revoked') revocations++;

    weightedTotal += weight;
    if (POSITIVE_STATUSES.includes(r.status)) {
      weightedPositive += weight;
    }
  }

  const positiveRate = weightedTotal > 0 ? weightedPositive / weightedTotal : 0;
  let rawScore = positiveRate * 100;

  // Revocation penalty
  const revPenalty = Math.min(revocations * REVOCATION_PENALTY, MAX_REVOCATION_PENALTY);
  rawScore -= revPenalty;

  // Small-sample damping: pull toward 50
  if (total < SMALL_SAMPLE_THRESHOLD) {
    const dampFactor = (SMALL_SAMPLE_THRESHOLD - total) / SMALL_SAMPLE_THRESHOLD;
    rawScore = rawScore * (1 - dampFactor) + 50 * dampFactor;
  }

  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  // Confidence
  const confidence: 'low' | 'medium' | 'high' =
    total < 5 ? 'low' : total < 15 ? 'medium' : 'high';

  // Label
  let label: ReliabilityIndicator['label'];
  if (total < MIN_REPORTS_FOR_LABEL) {
    label = 'Insufficient Data';
  } else if (score < 40) {
    label = 'Caution Advised';
  } else if (score < 60) {
    label = 'Mixed Reports';
  } else if (score < 80) {
    label = 'Mostly Positive';
  } else {
    label = 'Highly Positive';
  }

  // Explanation
  const parts: string[] = [];
  parts.push(`Based on ${total} community report${total > 1 ? 's' : ''} (${recentCount} in the last 6 months).`);
  const posCount = reports.filter(r => POSITIVE_STATUSES.includes(r.status)).length;
  const negCount = reports.filter(r => NEGATIVE_STATUSES.includes(r.status)).length;
  parts.push(`${posCount} positive, ${negCount} negative.`);
  if (revocations > 0) parts.push(`${revocations} revocation report${revocations > 1 ? 's' : ''} noted.`);
  if (total < SMALL_SAMPLE_THRESHOLD) parts.push('Small sample — treat with caution.');
  parts.push('This is community-reported data, not a verified prediction.');

  return {
    label,
    score,
    confidence,
    totalReports: total,
    recentReports: recentCount,
    positiveRate: Math.round(positiveRate * 100) / 100,
    explanation: parts.join(' '),
  };
}
