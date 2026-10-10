'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { forgotPasswordAction, resetPasswordAction } from '@/lib/auth/actions';
import { PASSWORD_MIN, forgotPasswordSchema, resetPasswordSchema, validate } from '@/lib/auth/validation';
import type { FieldErrors } from '@/lib/auth/validation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordField, TextField } from '@/components/ui/Field';
import { AuthCard } from './AuthCard';
import { useSession } from './AuthProvider';
import { focusFirstError } from './form-utils';

export function ForgotPasswordForm() {
  const notice = useSearchParams().get('notice');
  const { status } = useSession();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    const checked = validate(forgotPasswordSchema, { email });
    if (!checked.ok) {
      setErrors(checked.errors);
      focusFirstError(checked.errors, { email: 'forgot-email' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await forgotPasswordAction({ email: checked.data.email });
      if (result.status === 'sent') setSentTo(checked.data.email);
      else if (result.status === 'error') setFormError(result.message ?? 'Something went wrong. Please try again.');
    } catch {
      setFormError('We could not reach the server. Check your connection and try again.');
    }
    setSubmitting(false);
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your inbox">
        <div className="space-y-4">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <MailCheck className="h-5 w-5" aria-hidden />
            </span>
            {/* Same wording whether or not an account exists, so this form cannot be used to look up emails. */}
            <p className="text-sm leading-relaxed text-ink-soft">
              If an account exists for <strong className="break-all text-ink">{sentTo}</strong>, we have sent a link to reset the password. The link works once and expires after a short time.
            </p>
          </div>
          <Link href="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">
            Back to log in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email you signed up with and we will send you a link to choose a new password."
      footer={
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Back to log in
        </Link>
      }
    >
      {status === 'unconfigured' && (
        <Alert tone="warning" title="Accounts are not available yet" className="mb-5">
          This server has no account service configured.
        </Alert>
      )}
      {notice === 'link-expired' && (
        <Alert tone="warning" className="mb-5">
          Your reset link has expired or was already used. Request a new one below.
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField
          id="forgot-email"
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
        {formError && <Alert tone="error">{formError}</Alert>}
        <Button type="submit" fullWidth size="lg" loading={submitting} disabled={status === 'unconfigured'}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const { refresh } = useSession();
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    const checked = validate(resetPasswordSchema, { password });
    if (!checked.ok) {
      setErrors(checked.errors);
      focusFirstError(checked.errors, { password: 'reset-password' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await resetPasswordAction({ password });
      if (result.status === 'success') {
        await refresh();
        router.replace(result.redirectTo ?? '/dashboard');
        return;
      }
      if (result.status === 'error') {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.message ?? '');
      }
    } catch {
      setFormError('We could not reach the server. Check your connection and try again.');
    }
    setSubmitting(false);
  }

  return (
    <AuthCard title="Choose a new password" description="You are signed in with your reset link. Pick a new password to finish.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <PasswordField
          id="reset-password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={`At least ${PASSWORD_MIN} characters.`}
          required
        />
        {formError && (
          <Alert tone="error">
            {formError}{' '}
            {formError.includes('expired') && (
              <Link href="/forgot-password" className="font-medium underline">
                Request a new link
              </Link>
            )}
          </Alert>
        )}
        <Button type="submit" fullWidth size="lg" loading={submitting}>
          {submitting ? 'Saving…' : 'Update password'}
        </Button>
      </form>
    </AuthCard>
  );
}
