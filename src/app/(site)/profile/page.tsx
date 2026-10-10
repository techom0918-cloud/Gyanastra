import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ProfileView } from '@/components/auth/ProfileView';
import { Alert } from '@/components/ui/Alert';
import { LoadingRegion, Skeleton } from '@/components/ui/States';
import { Page, PageHeader } from '@/components/ui/PageHeader';
import { getAuthConfig } from '@/lib/auth/config';
import { getCurrentUser } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'Your profile' };

export default function ProfilePage() {
  return (
    <Page width="md">
      <PageHeader title="Your profile" description="Manage your account details." />
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
    </Page>
  );
}

// The session is read on the server, behind Suspense (it is request-time data). Without a valid session the visitor is
// redirected before any account content is rendered, so nothing signed-in ever flashes for a signed-out visitor.
async function ProfileContent() {
  if (!getAuthConfig()) {
    return (
      <Alert tone="warning" title="Accounts are not available yet">
        This server has no account service configured, so there is no profile to show.
      </Alert>
    );
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=%2Fprofile');
  return <ProfileView user={user} />;
}
