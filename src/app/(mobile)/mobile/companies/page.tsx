import type { Metadata } from 'next';
import { CompaniesView } from '@/components/features/CompaniesView';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Companies' };

export default function MobileCompaniesPage() {
  return (
    <>
      <PageHeader title="Companies" description="Community-reported offer outcomes." />
      <CompaniesView basePath="/mobile/companies" />
    </>
  );
}
