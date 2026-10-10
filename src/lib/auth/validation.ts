// Shared by the forms (inline validation) and the server actions (authoritative validation).
// The password policy follows current guidance: length matters, composition rules don't. Supabase enforces its own
// minimum on top of this.
import { z } from 'zod';

export const PASSWORD_MIN = 8;
/** bcrypt, which Supabase uses, ignores everything after 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;
export const NAME_MAX = 80;

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', '12345678', '123456789', '1234567890', 'qwertyui', 'qwertyuiop',
  'iloveyou', 'abc12345', 'admin123', 'welcome1', 'letmein1', 'aagey123', 'aageyaagey',
]);

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .max(254, 'That email address is too long')
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'));

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .refine((v) => new TextEncoder().encode(v).length <= PASSWORD_MAX_BYTES, `Use at most ${PASSWORD_MAX_BYTES} characters`)
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), 'That password is too common. Choose something harder to guess')
  .refine((v) => v.trim().length > 0, 'Password cannot be only spaces');

/** Display name: optional, trimmed, no control characters. */
export const nameSchema = z
  .string()
  .transform((v) => v.replace(/[\u0000-\u001f\u007f]/g, '').trim())
  .pipe(z.string().max(NAME_MAX, `Use at most ${NAME_MAX} characters`))
  .optional();

export const loginSchema = z.object({
  email: emailSchema,
  // No policy on login: existing accounts must still be able to sign in.
  password: z.string().min(1, 'Enter your password').max(1024),
  next: z.string().max(500).optional(),
});

export const signupSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    next: z.string().max(500).optional(),
  })
  .refine((v) => v.password.toLowerCase() !== v.email, { path: ['password'], message: 'Password cannot be the same as your email' });

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ password: newPasswordSchema });
export const profileSchema = z.object({ name: nameSchema });

export type FieldErrors = Record<string, string>;

/** First message per field, ready to show under the inputs. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Client-side check of one schema; returns field errors or null when valid. */
export function validate<T extends z.ZodType>(schema: T, input: unknown): { ok: true; data: z.infer<T> } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(input);
  return result.success ? { ok: true, data: result.data } : { ok: false, errors: toFieldErrors(result.error) };
}
