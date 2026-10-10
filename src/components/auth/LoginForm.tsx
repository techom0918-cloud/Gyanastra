'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { loginAction } from '@/lib/auth/actions';
import { loginSchema, validate } from '@/lib/auth/validation';
import type { FieldErrors } from '@/lib/auth/validation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordField, TextField } from '@/components/ui/Field';
import { AuthCard } from './AuthCard';
import { useSession } from './AuthProvider';
import { focusFirstError } from './form-utils';

const NOTICES: Record<string, { tone: 'info' | 'warning' | 'success'; text: string }> = {
  'link-problem': {
    tone: 'warning',
    text: 'That email link has expired, was already used, or was opened in a different browser than the one you signed up in. If you just confirmed your email, log in below.',
  },
  'password-updated': { tone: 'success', text: 'Your password has been updated. Log in with the new password.' },
};

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') ?? undefined;
  const noticeKey = params.get('notice') ?? '';
  const notice = Object.hasOwn(NOTICES, noticeKey) ? NOTICES[noticeKey] : undefined;
  const { status, refresh } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return; // ignore double clicks / double Enter
    setFormError('');

    const checked = validate(loginSchema, { email, password, next });
    if (!checked.ok) {
      setErrors(checked.errors);
      focusFirstError(checked.errors, { email: 'login-email', password: 'login-password' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await loginAction({ email: checked.data.email, password, next });
      if (result.status === 'success') {
        // Learn the new session first so the next page never flashes a signed-out state, then navigate.
        await refresh();
        router.replace(result.redirectTo ?? '/dashboard');
        return;
      }
      if (result.status === 'error') {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.message ?? '');
        if (result.fieldErrors) focusFirstError(result.fieldErrors, { email: 'login-email', password: 'login-password' });
      }
      setSubmitting(false);
    } catch {
      setFormError('We could not reach the server. Check your connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Log in to Aagey"
      description="Track your offers and keep them with your account."
      footer={
        <>
          New to Aagey?{' '}
          <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'} className="font-medium text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {status === 'unconfigured' && (
        <Alert tone="warning" title="Accounts are not available yet" className="mb-5">
          This server has no account service configured. You can still browse companies, submit reports and use the planner without an account.
        </Alert>
      )}
      {notice && (
        <Alert tone={notice.tone} className="mb-5">
          {notice.text}
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <PasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
          trailing={
            <Link href="/forgot-password" className="text-xs font-medium text-brand-700 hover:underline">
              Forgot password?
            </Link>
          }
        />
        {formError && <Alert tone="error">{formError}</Alert>}
        <Button type="submit" fullWidth size="lg" loading={submitting} disabled={status === 'unconfigured'}>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthCard>
  );
}
