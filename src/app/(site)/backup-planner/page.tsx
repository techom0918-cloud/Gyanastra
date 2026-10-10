import type { Metadata } from 'next';
import { PlannerView } from '@/components/features/PlannerView';
import { Page, PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Backup planner' };

export default function BackupPlannerPage() {
  return (
    <Page width="md">
      <PageHeader title="Backup career planner" description="A practical plan for the weeks ahead, based on your skills and offer status." />
      <PlannerView />
    </Page>
  );
}
