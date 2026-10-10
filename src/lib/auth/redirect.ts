// Safe post-login redirects. Only same-origin absolute paths are accepted, so a crafted ?next= can never send a
// user to another site (open redirect), and a login can never bounce straight back into an auth screen.

const BASE = 'http://aagey.invalid';
const AUTH_PATHS = /^\/(login|signup|forgot-password|reset-password|auth|api)(\/|\?|$)/;

export function safeNextPath(raw: unknown, fallback = '/dashboard'): string {
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim();
  if (value.length === 0 || value.length > 500) return fallback;
  // Reject protocol-relative ("//host"), backslash tricks ("/\host") and control characters outright.
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;

  // Normalisation can turn "/..//evil.com" into "//evil.com": check the result, not just the input.
  const path = url.pathname + url.search;
  if (path.startsWith('//') || AUTH_PATHS.test(path)) return fallback;
  return path;
}
