// Auth configuration, read from server-only environment variables (never NEXT_PUBLIC_*).
//   SUPABASE_URL              project URL (already used for the database)
//   SUPABASE_PUBLISHABLE_KEY  the project's publishable / anon key. This is the low-privilege key used for user sign-in.
// The secret / service-role key is for database access only and is refused here: a user-facing auth client must
// never be built with it, because it would bypass every access rule.

export interface AuthConfig {
  url: string;
  publishableKey: string;
}

type Env = Record<string, string | undefined>;

/** True for sb_secret_* keys and legacy JWTs whose role claim is service_role. */
export function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { role?: string };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

/** Returns null when accounts are not configured (or the configured key is unsafe). */
export function getAuthConfig(env: Env = process.env): AuthConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const publishableKey = (env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY)?.trim();
  if (!url || !publishableKey) return null;
  if (isPrivilegedKey(publishableKey)) {
    console.error('[aagey] SUPABASE_PUBLISHABLE_KEY holds a secret / service-role key. Accounts are disabled until it is replaced with the publishable (anon) key.');
    return null;
  }
  return { url, publishableKey };
}
