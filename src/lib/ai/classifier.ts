/**
 * AI Report Classifier
 * Classifies free-text offer descriptions into structured status.
 * Uses keyword-based classification (reliable, no API dependency).
 */

import { ClassificationResult, OfferStatus } from '@/types';

const KEYWORD_MAP: { status: OfferStatus; keywords: string[]; weight: number }[] = [
  { status: 'offer_revoked', keywords: ['revoked', 'rescinded', 'cancelled', 'withdrawn', 'terminated', 'revoke', 'cancel'], weight: 1.0 },
  { status: 'joining_delayed', keywords: ['delayed', 'postponed', 'pushed', 'waiting', 'no date', 'indefinite', 'still waiting', 'months'], weight: 0.9 },
  { status: 'joining_confirmed', keywords: ['confirmed', 'joining date', 'onboarded', 'started', 'joined', 'confirmation'], weight: 0.85 },
  { status: 'bg_verification_pending', keywords: ['background', 'verification', 'bgv', 'bg check', 'pending verification'], weight: 0.8 },
  { status: 'offer_received', keywords: ['received', 'got offer', 'selected', 'offer letter', 'accepted'], weight: 0.7 },
];

function extractDelayWeeks(text: string): number | undefined {
  // Try to extract delay duration
  const monthMatch = text.match(/(\d+)\s*month/i);
  if (monthMatch) return parseInt(monthMatch[1]) * 4;

  const weekMatch = text.match(/(\d+)\s*week/i);
  if (weekMatch) return parseInt(weekMatch[1]);

  const dayMatch = text.match(/(\d+)\s*day/i);
  if (dayMatch) return Math.round(parseInt(dayMatch[1]) / 7);

  return undefined;
}

export function classifyReport(description: string): ClassificationResult {
  const lower = description.toLowerCase();
  let bestMatch: { status: OfferStatus; score: number } = {
    status: 'offer_received',
    score: 0,
  };

  for (const entry of KEYWORD_MAP) {
    let matchCount = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) matchCount++;
    }
    const score = (matchCount / entry.keywords.length) * entry.weight;
    if (score > bestMatch.score) {
      bestMatch = { status: entry.status, score };
    }
  }

  const confidence = Math.min(bestMatch.score * 1.5, 0.95);
  const delayWeeks = bestMatch.status === 'joining_delayed' ? extractDelayWeeks(description) : undefined;

  // Build summary
  const summaryParts: string[] = [];
  if (bestMatch.status === 'joining_delayed' && delayWeeks) {
    summaryParts.push(`Delay of approximately ${delayWeeks} weeks reported.`);
  }
  summaryParts.push(`Classified as: ${bestMatch.status.replace(/_/g, ' ')}.`);
  if (confidence < 0.4) {
    summaryParts.push('Low confidence — please verify the status manually.');
  }

  return {
    proposedStatus: bestMatch.status,
    delayWeeks,
    summary: summaryParts.join(' '),
    confidence: Math.round(confidence * 100) / 100,
  };
}
