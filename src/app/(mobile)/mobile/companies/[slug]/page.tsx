import { Suspense } from 'react';
import { CompanyDetailView } from '@/components/features/CompanyDetailView';
import { Skeleton } from '@/components/ui/States';

export default function MobileCompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <CompanyBySlug params={params} />
    </Suspense>
  );
}

async function CompanyBySlug({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CompanyDetailView slug={slug} backHref="/mobile/companies" />;
}
