// Landing point for emailed links that carry a token_hash (recommended email templates, see docs/authentication.md).
// Unlike the PKCE code flow this also works when the email is opened on a different device or browser.
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthConfig } from '@/lib/auth/config';
import { safeNextPath } from '@/lib/auth/redirect';
import { createAuthClient } from '@/lib/auth/server';

const OTP_TYPES: readonly EmailOtpType[] = ['signup', 'email', 'recovery', 'invite', 'magiclink', 'email_change'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (tokenHash && type && OTP_TYPES.includes(type) && getAuthConfig()) {
    try {
      const supabase = await createAuthClient();
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) {
        const next = type === 'recovery' ? '/reset-password' : safeNextPath(searchParams.get('next'));
        return NextResponse.redirect(new URL(next, origin));
      }
    } catch {
      // fall through
    }
  }
  return NextResponse.redirect(new URL('/login?notice=link-problem', origin));
}
