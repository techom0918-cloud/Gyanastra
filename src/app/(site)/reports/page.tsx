import type { Metadata } from 'next';
import { ReportForm } from '@/components/features/ReportForm';
import { Page, PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Submit a report' };

export default function ReportSubmissionPage() {
  return (
    <Page width="md">
      <PageHeader title="Submit an offer report" description="Anonymously share what happened with a campus placement offer. No account needed." />
      <ReportForm />
    </Page>
  );
}
