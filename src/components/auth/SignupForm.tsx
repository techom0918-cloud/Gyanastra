'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { resendConfirmationAction, signupAction } from '@/lib/auth/actions';
import { PASSWORD_MIN, signupSchema, validate } from '@/lib/auth/validation';
import type { FieldErrors } from '@/lib/auth/validation';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordField, TextField } from '@/components/ui/Field';
import { AuthCard } from './AuthCard';
import { useSession } from './AuthProvider';
import { focusFirstError } from './form-utils';

const IDS = { name: 'signup-name', email: 'signup-email', password: 'signup-password' };

export function SignupForm() {
  const next = useSearchParams().get('next') ?? undefined;
  const { status, refresh } = useSession();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError('');

    const checked = validate(signupSchema, { name: name || undefined, email, password, next });
    if (!checked.ok) {
      setErrors(checked.errors);
      focusFirstError(checked.errors, IDS);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await signupAction({ name: checked.data.name, email: checked.data.email, password, next });
      if (result.status === 'confirm_email') {
        setConfirmEmail(result.email);
      } else if (result.status === 'success') {
        await refresh();
        router.replace(result.redirectTo ?? '/dashboard');
        return;
      } else if (result.status === 'error') {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.message ?? '');
        if (result.fieldErrors) focusFirstError(result.fieldErrors, IDS);
      }
    } catch {
      setFormError('We could not reach the server. Check your connection and try again.');
    }
    setSubmitting(false);
  }

  if (confirmEmail) return <CheckInbox email={confirmEmail} onBack={() => setConfirmEmail(null)} />;

  return (
    <AuthCard
      title="Create your account"
      description="Keep your tracked offers and alerts with you. Reporting outcomes and browsing companies never require an account."
      footer={
        <>
          Already have an account?{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-medium text-brand-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {status === 'unconfigured' && (
        <Alert tone="warning" title="Accounts are not available yet" className="mb-5">
          This server has no account service configured, so sign-up is switched off for now.
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField
          id={IDS.name}
          label="Name"
          optional
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          hint="Only used for the greeting in your dashboard."
          maxLength={80}
        />
        <TextField
          id={IDS.email}
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
          id={IDS.password}
          label="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={`At least ${PASSWORD_MIN} characters. A short sentence works well.`}
          required
        />
        {formError && <Alert tone="error">{formError}</Alert>}
        <Button type="submit" fullWidth size="lg" loading={submitting} disabled={status === 'unconfigured'}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}

function CheckInbox({ email, onBack }: { email: string; onBack: () => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function resend() {
    if (state === 'sending') return;
    setState('sending');
    try {
      const result = await resendConfirmationAction({ email });
      if (result.status === 'sent') setState('sent');
      else {
        setState('error');
        setMessage(result.status === 'error' ? (result.message ?? 'Could not resend the email.') : 'Could not resend the email.');
      }
    } catch {
      setState('error');
      setMessage('We could not reach the server. Try again in a moment.');
    }
  }

  return (
    <AuthCard title="Check your inbox">
      <div className="space-y-4">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MailCheck className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-ink-soft">
            We sent a confirmation link to <strong className="break-all text-ink">{email}</strong>. Open it to finish creating your account, then log in.
            It can take a minute to arrive; check your spam folder too.
          </p>
        </div>
        {state === 'sent' && <Alert tone="success">Another email is on its way.</Alert>}
        {state === 'error' && <Alert tone="error">{message}</Alert>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" fullWidth loading={state === 'sending'} onClick={resend}>
            Resend email
          </Button>
          <Button variant="ghost" fullWidth onClick={onBack}>
            Use a different email
          </Button>
        </div>
        <p className="text-center text-sm text-muted">
          Already confirmed?{' '}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
