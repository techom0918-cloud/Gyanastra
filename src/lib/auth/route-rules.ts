// Which routes need a session, as a pure function so it can be tested without a server.
// This is only the optimistic first gate (in proxy.ts). Real authorisation happens again where data is read:
// getCurrentUser() in route handlers and server components, and ownership checks in the store.
import { safeNextPath } from './redirect';

/** Pages that require a signed-in user. */
export const PROTECTED_PREFIXES = ['/profile', '/mobile/profile'];
/** Pages only for signed-out visitors; signed-in users are sent on to their dashboard. */
export const GUEST_ONLY_PATHS = ['/login', '/signup', '/forgot-password'];

const matches = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

export type RouteDecision = { type: 'next' } | { type: 'redirect'; to: string };

export function routeDecision({ pathname, search = '', signedIn }: { pathname: string; search?: string; signedIn: boolean }): RouteDecision {
  if (!signedIn && PROTECTED_PREFIXES.some((p) => matches(pathname, p))) {
    return { type: 'redirect', to: `/login?next=${encodeURIComponent(pathname + search)}` };
  }
  // The password-reset form only works with the temporary session created by the emailed link.
  if (!signedIn && matches(pathname, '/reset-password')) {
    return { type: 'redirect', to: '/forgot-password?notice=link-expired' };
  }
  if (signedIn && GUEST_ONLY_PATHS.some((p) => matches(pathname, p))) {
    const next = new URLSearchParams(search).get('next');
    return { type: 'redirect', to: safeNextPath(next) };
  }
  return { type: 'next' };
}
