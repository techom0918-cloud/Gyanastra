// What every Career Intelligence API route starts with: the validated session user and a repository bound to that user.
// Nothing here accepts a user id from the request.
import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthConfig } from '@/lib/auth/config';
import { getAuthenticatedSession, getCurrentUser } from '@/lib/auth/server';
import type { AuthUser } from '@/lib/auth/types';
import { createSlidingWindowLimiter } from '@/lib/abuse/submissions';
import { CareerStoreError, createSupabaseCareerRepository, type CareerRepository } from './repository';

export interface CareerContext {
  user: AuthUser;
  repo: CareerRepository;
}

// Per-user limits (per server instance, best effort), so one account cannot hammer the database or the AI provider.
const REQUEST_LIMIT = 60;
let requestLimiter = createSlidingWindowLimiter(REQUEST_LIMIT, 10 * 60_000);
export const aiLimiter = createSlidingWindowLimiter(5, 10 * 60_000);

type Factory = (user: AuthUser) => Promise<CareerRepository>;
let factoryOverride: Factory | null = null;
/** Tests inject a repository; production always uses the signed-in user's own Supabase client. */
export function setCareerRepositoryFactoryForTesting(factory: Factory | null) {
  factoryOverride = factory;
  requestLimiter = createSlidingWindowLimiter(REQUEST_LIMIT, 10 * 60_000); // fresh counts for every test
}

export const json = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: { 'Cache-Control': 'private, no-store', ...init?.headers } });

/** Resolves the caller, or the exact error response to return. */
export async function getCareerContext(): Promise<{ ok: true; ctx: CareerContext } | { ok: false; response: NextResponse }> {
  if (!factoryOverride && !getAuthConfig()) {
    return { ok: false, response: json({ error: 'Accounts are not available on this server yet.' }, { status: 503 }) };
  }
  // Production: one client both validates the session and runs the queries (RLS then sees the same user).
  const session = factoryOverride ? null : await getAuthenticatedSession();
  const user = factoryOverride ? await getCurrentUser() : session?.user ?? null;
  if (!user) return { ok: false, response: json({ error: 'Please sign in to use Career Intelligence.' }, { status: 401 }) };
  if (!requestLimiter.tryConsume(`user:${user.id}`, Date.now())) {
    return { ok: false, response: json({ error: 'Too many requests. Please wait a few minutes and try again.' }, { status: 429, headers: { 'Retry-After': '60' } }) };
  }
  const repo = factoryOverride ? await factoryOverride(user) : createSupabaseCareerRepository(session!.client, user.id);
  return { ok: true, ctx: { user, repo } };
}

export function careerErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof CareerStoreError && error.kind === 'not_enabled') {
    console.error('[aagey] career:', error.message);
    return json({ error: 'Career Intelligence is not enabled on this server yet. Please try again later.' }, { status: 503 });
  }
  console.error('[aagey] career:', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error');
  return json({ error: fallback }, { status: 500 });
}
