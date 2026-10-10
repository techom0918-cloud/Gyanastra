'use client';

import { KeyRound, LayoutDashboard, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { updateProfileAction } from '@/lib/auth/actions';
import { NAME_MAX, profileSchema, validate } from '@/lib/auth/validation';
import type { FieldErrors } from '@/lib/auth/validation';
import type { AuthUser } from '@/lib/auth/types';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { Avatar, useLogout } from './AccountMenu';
import { useSession } from './AuthProvider';

/** Account page for a signed-in user. `base` is "" on the site and "/mobile" inside the app shell. */
export function ProfileView({ user, base = '' }: { user: AuthUser; base?: string }) {
  const { refresh } = useSession();
  const logout = useLogout();
  const [name, setName] = useState(user.name === user.email.split('@')[0] ? '' : user.name);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setMessage(null);
    const checked = validate(profileSchema, { name: name || undefined });
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const result = await updateProfileAction({ name: checked.data.name });
      if (result.status === 'success') {
        await refresh(); // the header and greeting pick up the new name
        setMessage({ tone: 'success', text: result.message ?? 'Profile saved.' });
      } else if (result.status === 'error') {
        setErrors(result.fieldErrors ?? {});
        setMessage({ tone: 'error', text: result.message ?? 'Could not save your profile.' });
      }
    } catch {
      setMessage({ tone: 'error', text: 'We could not reach the server. Try again in a moment.' });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <Card className="flex items-center gap-4 p-5">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-ink">{user.name}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Profile" description="Your name is only used for the greeting in your dashboard." />
        <form onSubmit={save} noValidate className="space-y-4 p-4 sm:p-5">
          <TextField
            id="profile-name"
            label="Name"
            optional
            autoComplete="name"
            maxLength={NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <TextField id="profile-email" label="Email" value={user.email} readOnly disabled hint="To change your email, contact the Aagey team." />
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
          <Button type="submit" loading={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Your account" />
        <ul className="divide-y divide-line text-sm">
          <li>
            <Link href={base ? `${base}/offers` : '/tracker'} className="flex min-h-12 items-center gap-3 px-4 text-ink hover:bg-brand-50 sm:px-5">
              <LayoutDashboard className="h-4 w-4 text-muted" aria-hidden /> Your tracked offers
            </Link>
          </li>
          <li>
            <Link href="/forgot-password" className="flex min-h-12 items-center gap-3 px-4 text-ink hover:bg-brand-50 sm:px-5">
              <KeyRound className="h-4 w-4 text-muted" aria-hidden /> Change password by email
            </Link>
          </li>
        </ul>
      </Card>

      <Button
        variant="danger"
        fullWidth
        loading={loggingOut}
        onClick={async () => {
          setLoggingOut(true);
          await logout();
        }}
      >
        <LogOut className="h-4 w-4" aria-hidden /> Log out
      </Button>
      <ButtonLink href={base || '/dashboard'} variant="ghost" fullWidth>
        Back to {base ? 'home' : 'dashboard'}
      </ButtonLink>
    </div>
  );
}
