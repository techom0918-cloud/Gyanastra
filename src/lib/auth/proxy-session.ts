// Session refresh for proxy.ts: validates the access token (refreshing it when expired) and writes the new
// cookies onto the outgoing response, so Server Components and route handlers see a fresh session.
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { AuthConfig } from './config';
import { hardenCookie } from './cookies';

export async function updateSession(request: NextRequest, config: AuthConfig) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, hardenCookie(options));
      },
    },
  });

  // getClaims() verifies the token's signature (locally for asymmetric keys) and refreshes it when it has expired.
  const { data, error } = await supabase.auth.getClaims();
  return { response, signedIn: !error && Boolean(data?.claims?.sub) };
}

/** Redirects must carry any cookies the refresh just set. */
export function redirectWithCookies(to: string, from: NextResponse, request: NextRequest): NextResponse {
  const redirect = NextResponse.redirect(new URL(to, request.url));
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
