import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { CareerIntelligenceView } from '@/components/career/CareerIntelligenceView';
import { Alert } from '@/components/ui/Alert';
import { LoadingRegion, Skeleton } from '@/components/ui/States';
import { Page, PageHeader } from '@/components/ui/PageHeader';
import { getAuthConfig } from '@/lib/auth/config';
import { getCurrentUser } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'Career Intelligence' };

export default function CareerIntelligencePage() {
  return (
    <Page>
      <PageHeader
        title="Career Intelligence"
        description="Personal, private guidance on your offer, your job situation and your next 90 days. It is built from what you tell us, and it is guidance, not prediction."
      />
      <Suspense
        fallback={
          <LoadingRegion label="Loading Career Intelligence" className="space-y-4">
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </LoadingRegion>
        }
      >
        <CareerContent />
      </Suspense>
    </Page>
  );
}

// Like /profile: the session is checked on the server and signed-out visitors are redirected before anything renders.
async function CareerContent() {
  if (!getAuthConfig()) {
    return (
      <Alert tone="warning" title="Accounts are not available yet">
        Career Intelligence needs an account, and this server has no account service configured.
      </Alert>
    );
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=%2Fcareer-intelligence');
  return <CareerIntelligenceView />;
}
