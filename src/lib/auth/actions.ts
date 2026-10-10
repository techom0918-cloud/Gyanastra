'use server';

// Account server actions. Every action re-validates its input (the forms validate too, but only the server counts),
// is rate-limited per client and per account, and answers in ways that do not reveal whether an email is registered.
// Passwords are passed straight to Supabase Auth: never logged, stored or returned.
import { createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { clientAddress, createSlidingWindowLimiter, submitterHash, submitterSecret } from '@/lib/abuse/submissions';
import { getAuthConfig } from './config';
import { safeNextPath } from './redirect';
import { createAuthClient } from './server';
import type { ActionResult } from './types';
import {
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  resetPasswordSchema,
  signupSchema,
  toFieldErrors,
} from './validation';

// Per server instance (best effort); Supabase Auth applies its own global rate limits on top.
const loginIp = createSlidingWindowLimiter(15, 10 * 60_000);
const loginAccount = createSlidingWindowLimiter(8, 10 * 60_000);
const signupIp = createSlidingWindowLimiter(6, 60 * 60_000);
const emailActions = createSlidingWindowLimiter(5, 60 * 60_000);
const passwordChanges = createSlidingWindowLimiter(10, 10 * 60_000);

const NOT_CONFIGURED: ActionResult = { status: 'error', message: 'Accounts are not available on this server yet.' };
const TOO_MANY: ActionResult = { status: 'error', message: 'Too many attempts. Please wait a few minutes and try again.' };
const GENERIC: ActionResult = { status: 'error', message: 'Something went wrong. Please try again.' };

const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 32);

async function clientKey(): Promise<string> {
  return submitterHash(clientAddress(await headers()), new Date(), submitterSecret());
}

/**
 * Where emailed links must point. Never derived from request headers in production (a forged Host header could
 * otherwise poison password-reset links): set AAGEY_SITE_URL, or rely on Vercel's production URL variable.
 * Locally the request's own localhost origin is used. When nothing safe is known, Supabase's Site URL applies.
 */
async function siteOrigin(): Promise<string | null> {
  const explicit = process.env.AAGEY_SITE_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      // fall through
    }
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  const host = (await headers()).get('host') ?? '';
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? `http://${host}` : null;
}

interface AuthErrorLike {
  code?: string;
  status?: number;
  name?: string;
}

function describeAuthError(error: AuthErrorLike, context: 'login' | 'signup' | 'password'): ActionResult {
  const code = error.code ?? '';
  if (error.status === 429 || code.startsWith('over_')) return TOO_MANY;
  switch (code) {
    case 'invalid_credentials':
      return { status: 'error', message: 'Incorrect email or password.' };
    case 'email_not_confirmed':
      return { status: 'error', message: 'Please confirm your email first. Check your inbox for the confirmation link.' };
    case 'weak_password':
      return { status: 'error', fieldErrors: { password: 'Choose a stronger password (longer, and not a common one).' } };
    case 'same_password':
      return { status: 'error', fieldErrors: { password: 'Choose a password you have not used before.' } };
    case 'signup_disabled':
      return { status: 'error', message: 'New sign-ups are currently turned off.' };
  }
  console.error(`[aagey] auth ${context} failed:`, code || error.name || 'unknown');
  return GENERIC;
}

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', fieldErrors: toFieldErrors(parsed.error) };
  if (!getAuthConfig()) return NOT_CONFIGURED;

  const { email, password, next } = parsed.data;
  const now = Date.now();
  if (!loginIp.tryConsume(await clientKey(), now) || !loginAccount.tryConsume(hash(email), now)) return TOO_MANY;

  try {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return describeAuthError(error, 'login');
    return { status: 'success', redirectTo: safeNextPath(next) };
  } catch {
    return GENERIC;
  }
}

export async function signupAction(input: unknown): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', fieldErrors: toFieldErrors(parsed.error) };
  if (!getAuthConfig()) return NOT_CONFIGURED;

  const { name, email, password, next } = parsed.data;
  if (!signupIp.tryConsume(await clientKey(), Date.now())) return TOO_MANY;

  try {
    const supabase = await createAuthClient();
    const origin = await siteOrigin();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...(name ? { data: { full_name: name } } : {}),
        ...(origin ? { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}` } : {}),
      },
    });
    if (error) return describeAuthError(error, 'signup');
    // A session exists only when email confirmation is switched off. Otherwise (the usual case) the user must
    // confirm. The same answer is given for an address that is already registered, so signup cannot be used to
    // discover which emails have accounts.
    if (data.session) return { status: 'success', redirectTo: safeNextPath(next) };
    return { status: 'confirm_email', email };
  } catch {
    return GENERIC;
  }
}

export async function resendConfirmationAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', fieldErrors: toFieldErrors(parsed.error) };
  if (!getAuthConfig()) return NOT_CONFIGURED;

  const { email } = parsed.data;
  const now = Date.now();
  if (!emailActions.tryConsume(await clientKey(), now) || !emailActions.tryConsume(`resend:${hash(email)}`, now)) return TOO_MANY;

  try {
    const supabase = await createAuthClient();
    const origin = await siteOrigin();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      ...(origin ? { options: { emailRedirectTo: `${origin}/auth/callback` } } : {}),
    });
    if (error && (error.status === 429 || error.code?.startsWith('over_'))) return TOO_MANY;
    return { status: 'sent' };
  } catch {
    return GENERIC;
  }
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', fieldErrors: toFieldErrors(parsed.error) };
  if (!getAuthConfig()) return NOT_CONFIGURED;

  const { email } = parsed.data;
  const now = Date.now();
  if (!emailActions.tryConsume(await clientKey(), now) || !emailActions.tryConsume(`reset:${hash(email)}`, now)) return TOO_MANY;

  try {
    const supabase = await createAuthClient();
    const origin = await siteOrigin();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      ...(origin ? { redirectTo: `${origin}/auth/callback?next=/reset-password` } : {}),
    });
    if (error && (error.status === 429 || error.code?.startsWith('over_'))) return TOO_MANY;
    // Always "sent", whether or not the address has an account (no account enumeration).
    return { status: 'sent' };
  } catch {
    return GENERIC;
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', fieldErrors: toFieldErrors(parsed.error) };
  if (!getAuthConfig()) return NOT_CONFIGURED;
  if (!passwordChanges.tryConsume(await clientKey(), Date.now())) return TOO_MANY;

  try {
    const supabase = await createAuthClient();
    // The emailed link signs the user in temporarily; without that session there is nothing to reset.
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { status: 'error', message: 'Your reset link has expired. Please request a new one.' };

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return describeAuthError(error, 'password');
    return { status: 'success', redirectTo: '/dashboard', message: 'Your password has been updated.' };
  } catch {
    return GENERIC;
  }
}

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', fieldErrors: toFieldErrors(parsed.error) };
  if (!getAuthConfig()) return NOT_CONFIGURED;

  try {
    const supabase = await createAuthClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { status: 'error', message: 'Please log in again.' };

    const { error } = await supabase.auth.updateUser({ data: { full_name: parsed.data.name ?? '' } });
    if (error) return describeAuthError(error, 'password');
    return { status: 'success', message: 'Profile saved.' };
  } catch {
    return GENERIC;
  }
}

export async function logoutAction(): Promise<ActionResult> {
  if (!getAuthConfig()) return { status: 'success', redirectTo: '/' };
  try {
    const supabase = await createAuthClient();
    // "local" ends this browser's session only; the user's other devices stay signed in.
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Handled below.
  }
  // If the Auth server could not be reached, signOut leaves the session in place. Logging out must still work, so
  // the session cookies (named sb-*) are always removed here.
  const store = await cookies();
  for (const cookie of store.getAll()) {
    if (cookie.name.startsWith('sb-')) store.delete(cookie.name);
  }
  return { status: 'success', redirectTo: '/' };
}
