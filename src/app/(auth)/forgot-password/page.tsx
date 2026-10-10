import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCardSkeleton } from '@/components/auth/AuthCard';
import { ForgotPasswordForm } from '@/components/auth/RecoveryForms';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
