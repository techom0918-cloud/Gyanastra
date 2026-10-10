import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCardSkeleton } from '@/components/auth/AuthCard';
import { SignupForm } from '@/components/auth/SignupForm';

export const metadata: Metadata = { title: 'Create account' };

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <SignupForm />
    </Suspense>
  );
}
