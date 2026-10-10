import type { Metadata } from 'next';
import { ReportForm } from '@/components/features/ReportForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Submit a report' };

export default function MobileReportPage() {
  return (
    <>
      <PageHeader title="Submit a report" description="Anonymously share what happened with an offer. No account needed." />
      <ReportForm companiesHref="/mobile/companies" />
    </>
  );
}
