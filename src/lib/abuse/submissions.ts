// Abuse controls for anonymous report submission.
//
// A submitter is identified only by HMAC-SHA256(secret, "<UTC day>|<client address>"): the raw address is never
// stored, and because the day is part of the input, hashes from different days cannot be linked. The limits are
// enforced against the database (offer_reports.submitter_hash), so they hold across serverless instances.
// If that column is missing (migration not yet applied), a per-instance in-memory fallback is used: best effort only.
import { createHmac, randomBytes } from 'node:crypto';

export const SUBMISSION_LIMITS = {
  /** Reports per submitter in any rolling window of `windowMinutes`. */
  perWindow: 3,
  windowMinutes: 10,
  /** Reports per submitter per UTC day. */
  perDay: 10,
} as const;

export interface RecentSubmission {
  companySlug: string;
  status: string;
  /** ISO timestamp */
  createdAt: string;
}

export type SubmissionDecision =
  | { allowed: true }
  | { allowed: false; status: 409 | 429; error: string; retryAfterSeconds?: number };

/** Decides whether a new report may be stored, given the same submitter's reports from today (UTC). */
export function decideSubmission(
  recentToday: RecentSubmission[],
  candidate: { companySlug: string; status: string },
  now: Date
): SubmissionDecision {
  if (recentToday.some((r) => r.companySlug === candidate.companySlug && r.status === candidate.status)) {
    return {
      allowed: false,
      status: 409,
      error: 'You already submitted this outcome for this company today. Duplicate reports are not counted.',
    };
  }
  if (recentToday.length >= SUBMISSION_LIMITS.perDay) {
    const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return {
      allowed: false,
      status: 429,
      error: 'Daily report limit reached. Please try again tomorrow.',
      retryAfterSeconds: Math.max(1, Math.ceil((tomorrow - now.getTime()) / 1000)),
    };
  }
  const windowMs = SUBMISSION_LIMITS.windowMinutes * 60_000;
  const inWindow = recentToday
    .map((r) => Date.parse(r.createdAt))
    .filter((t) => Number.isFinite(t) && now.getTime() - t < windowMs)
    .sort((a, b) => a - b);
  if (inWindow.length >= SUBMISSION_LIMITS.perWindow) {
    const oldest = inWindow[inWindow.length - SUBMISSION_LIMITS.perWindow];
    return {
      allowed: false,
      status: 429,
      error: `Too many reports in a short time. Please wait a few minutes.`,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now.getTime()) / 1000)),
    };
  }
  return { allowed: true };
}

/** Start of the current UTC day as an ISO timestamp. */
export function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/**
 * Best-effort client address. On Vercel, x-forwarded-for is set by the platform (the client cannot spoof the
 * first entry); behind other proxies this must be revisited. Unknown clients share one bucket.
 */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const real = headers.get('x-real-ip')?.trim();
  return (forwarded || real || 'unknown').slice(0, 100);
}

let processSecret: string | null = null;

/**
 * Key for submitter hashes: AAGEY_RATE_LIMIT_SECRET if set; otherwise derived (one-way) from the Supabase secret key,
 * so production works without extra configuration; otherwise a random per-process key (local/in-memory mode).
 */
export function submitterSecret(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.AAGEY_RATE_LIMIT_SECRET?.trim();
  if (explicit) return explicit;
  const supabaseKey = env.SUPABASE_SECRET_KEY?.trim();
  if (supabaseKey) return createHmac('sha256', supabaseKey).update('aagey-submitter-hash-v1').digest('hex');
  processSecret ??= randomBytes(32).toString('hex');
  return processSecret;
}

export function submitterHash(address: string, now: Date, secret: string): string {
  const day = now.toISOString().slice(0, 10);
  return createHmac('sha256', secret).update(`${day}|${address}`).digest('hex').slice(0, 32);
}

/**
 * Per-instance sliding-window limiter (in memory). Not global across serverless instances: use only where
 * best effort is acceptable, e.g. capping paid AI calls with a free fallback.
 */
export function createSlidingWindowLimiter(limit: number, windowMs: number, maxKeys = 10_000) {
  const hits = new Map<string, number[]>();
  return {
    /** Records a hit and returns true if the key is still within the limit. */
    tryConsume(key: string, nowMs: number): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => nowMs - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      if (hits.size >= maxKeys && !hits.has(key)) hits.delete(hits.keys().next().value!);
      hits.set(key, [...recent, nowMs]);
      return true;
    },
  };
}

/** Per-instance fallback store (used only when the database cannot record submitter hashes). */
export function createLocalSubmissionLog(maxEntries = 10_000) {
  const log = new Map<string, RecentSubmission[]>();
  return {
    list(hash: string, sinceIso: string): RecentSubmission[] {
      return (log.get(hash) ?? []).filter((r) => r.createdAt >= sinceIso);
    },
    record(hash: string, entry: RecentSubmission): void {
      if (log.size >= maxEntries && !log.has(hash)) log.delete(log.keys().next().value!);
      log.set(hash, [...(log.get(hash) ?? []).filter((r) => r.createdAt.slice(0, 10) === entry.createdAt.slice(0, 10)), entry]);
    },
  };
}
