import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCardSkeleton } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  // The form reads ?next= and ?notice=, which is request-time data, so it streams in behind a boundary.
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
