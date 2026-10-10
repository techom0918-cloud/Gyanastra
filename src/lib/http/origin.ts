// CSRF defence in depth for state-changing API routes. Session cookies are SameSite=Lax (not sent on cross-site
// POSTs) and bodies must be JSON, and on top of that a browser request that names a different Origin is refused.
// Requests without an Origin header (curl, server-to-server) cannot carry a victim's cookies and are allowed.
import { NextResponse } from 'next/server';

export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false; // e.g. "null" from sandboxed frames
  }
  return host === req.headers.get('host') || host === req.headers.get('x-forwarded-host');
}

export function crossOriginResponse(): NextResponse {
  return NextResponse.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
}
