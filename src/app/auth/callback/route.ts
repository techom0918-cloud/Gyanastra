// Landing point for emailed links that use the PKCE flow (Supabase's default templates): exchanges the one-time
// code for a session cookie, then sends the user on. Works only in the browser that requested the email.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthConfig } from '@/lib/auth/config';
import { safeNextPath } from '@/lib/auth/redirect';
import { createAuthClient } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const rawNext = searchParams.get('next');
  // Password-recovery links legitimately continue to /reset-password; everything else goes through safeNextPath.
  const next = rawNext === '/reset-password' ? rawNext : safeNextPath(rawNext);
  const code = searchParams.get('code');

  if (code && getAuthConfig()) {
    try {
      const supabase = await createAuthClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, origin));
    } catch {
      // fall through to the friendly failure page
    }
  }
  return NextResponse.redirect(new URL('/login?notice=link-problem', origin));
}
