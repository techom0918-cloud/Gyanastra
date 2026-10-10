import type { Metadata } from 'next';
import { DashboardHeading, DashboardView } from '@/components/features/DashboardView';
import { Page } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <Page width="xl">
      <DashboardHeading />
      <DashboardView />
    </Page>
  );
}
