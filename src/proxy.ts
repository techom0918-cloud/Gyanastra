// Runs before every page request (Next.js 16 "proxy", formerly "middleware"):
// 1. refreshes the Supabase session cookie, and
// 2. redirects visitors away from pages that need (or must not have) a session.
// This is only the first, optimistic gate. Data is authorised again where it is read (see lib/auth/server.ts).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthConfig } from '@/lib/auth/config';
import { redirectWithCookies, updateSession } from '@/lib/auth/proxy-session';
import { routeDecision } from '@/lib/auth/route-rules';

export async function proxy(request: NextRequest) {
  const config = getAuthConfig();
  if (!config) {
    // Accounts are not configured: protected pages render their own "not available yet" state.
    return NextResponse.next();
  }

  const { response, signedIn } = await updateSession(request, config);
  const decision = routeDecision({ pathname: request.nextUrl.pathname, search: request.nextUrl.search, signedIn });
  return decision.type === 'redirect' ? redirectWithCookies(decision.to, response, request) : response;
}

export const config = {
  // Pages only: skip API routes (they validate the session themselves), Next internals and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpe?g|gif|webp|ico|txt|xml)$).*)'],
};
