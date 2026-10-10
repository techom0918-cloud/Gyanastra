// Session cookies are written only by the server (there is no Supabase client in the browser), so they can be
// HttpOnly: page scripts can never read the tokens.
export interface CookieOptions {
  path?: string;
  maxAge?: number;
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | 'lax' | 'strict' | 'none';
}

export function hardenCookie(options: CookieOptions | undefined, production = process.env.NODE_ENV === 'production'): CookieOptions {
  return { ...options, path: '/', httpOnly: true, sameSite: 'lax', secure: production };
}
