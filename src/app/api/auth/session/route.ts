import { NextResponse, connection } from 'next/server';
import { getAuthConfig } from '@/lib/auth/config';
import { getCurrentUser } from '@/lib/auth/server';
import type { SessionPayload } from '@/lib/auth/types';

// What the browser may know about the session: whether accounts exist at all, and who (name + email) is signed in.
// Tokens stay in HttpOnly cookies and are never returned.
export async function GET() {
  await connection();
  const configured = getAuthConfig() !== null;
  const user = configured ? await getCurrentUser() : null;
  const body: SessionPayload = { configured, user };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
