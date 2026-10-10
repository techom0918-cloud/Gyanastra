import { Suspense } from 'react';
import { CompanyDetailView } from '@/components/features/CompanyDetailView';
import { Page } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/States';

export default function CompanyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  // The slug is a request-time value, so the view streams in behind a boundary.
  return (
    <Page>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <CompanyBySlug params={params} />
      </Suspense>
    </Page>
  );
}

async function CompanyBySlug({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CompanyDetailView slug={slug} />;
}
