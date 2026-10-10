// Server-side Supabase Auth: a per-request client bound to the request's cookies, and the Data Access Layer
// function every protected read goes through. Only the low-privilege publishable key is used here.
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getAuthConfig } from './config';
import { hardenCookie } from './cookies';
import type { AuthUser } from './types';

export class AuthNotConfiguredError extends Error {
  constructor() {
    super('Accounts are not configured: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY');
    this.name = 'AuthNotConfiguredError';
  }
}

/** A new client per request. Never share one across requests. */
export async function createAuthClient(): Promise<SupabaseClient> {
  const config = getAuthConfig();
  if (!config) throw new AuthNotConfiguredError();
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, hardenCookie(options));
        } catch {
          // Called while rendering a Server Component, where cookies are read-only. proxy.ts refreshes sessions.
        }
      },
    },
  });
}

export function toAuthUser(user: Pick<User, 'id' | 'email' | 'user_metadata'>): AuthUser {
  const email = user.email ?? '';
  const metaName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  return { id: user.id, email, name: (metaName || email.split('@')[0] || 'there').slice(0, 80) };
}

/**
 * The signed-in user AND the client that validated them, so database calls reuse the same (possibly just-refreshed)
 * session instead of building a second client that could read a stale cookie and refresh the token twice.
 */
export async function getAuthenticatedSession(): Promise<{ user: AuthUser; client: SupabaseClient } | null> {
  if (!getAuthConfig()) return null;
  try {
    const client = await createAuthClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return { user: toAuthUser(data.user), client };
  } catch (error) {
    console.error('[aagey] could not read the session:', error instanceof Error ? error.name : 'unknown error');
    return null;
  }
}

/**
 * The signed-in user, or null. getUser() asks the Auth server to validate the token on every call, so a revoked
 * or expired session is never trusted (unlike reading the cookie, which proves nothing).
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!getAuthConfig()) return null;
  try {
    const supabase = await createAuthClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return toAuthUser(data.user);
  } catch (error) {
    console.error('[aagey] could not read the session:', error instanceof Error ? error.name : 'unknown error');
    return null;
  }
}
