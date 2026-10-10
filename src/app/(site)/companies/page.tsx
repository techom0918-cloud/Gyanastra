import type { Metadata } from 'next';
import { CompaniesView } from '@/components/features/CompaniesView';
import { Page, PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Companies' };

export default function CompaniesPage() {
  return (
    <Page>
      <PageHeader title="Companies" description="Community-reported offer outcomes and transparent reliability indicators. Sample size and evidence quality are shown with every score." />
      <CompaniesView />
    </Page>
  );
}
