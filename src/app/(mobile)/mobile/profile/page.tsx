import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ProfileView } from '@/components/auth/ProfileView';
import { Alert } from '@/components/ui/Alert';
import { LoadingRegion, Skeleton } from '@/components/ui/States';
import { PageHeader } from '@/components/ui/PageHeader';
import { getAuthConfig } from '@/lib/auth/config';
import { getCurrentUser } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'Your profile' };

export default function MobileProfilePage() {
  return (
    <>
      <PageHeader title="Your profile" />
      <Suspense
        fallback={
          <LoadingRegion label="Loading your profile" className="space-y-5">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </LoadingRegion>
        }
      >
        <ProfileContent />
      </Suspense>
    </>
  );
}

// Same server-side check as /profile: no valid session means a redirect before any account content renders.
async function ProfileContent() {
  if (!getAuthConfig()) {
    return (
      <Alert tone="warning" title="Accounts are not available yet">
        This server has no account service configured, so there is no profile to show.
      </Alert>
    );
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=%2Fmobile%2Fprofile');
  return <ProfileView user={user} base="/mobile" />;
}
