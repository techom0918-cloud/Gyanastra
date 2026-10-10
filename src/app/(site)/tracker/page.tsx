import type { Metadata } from 'next';
import { TrackerView } from '@/components/features/TrackerView';
import { Page, PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Track an offer' };

export default function TrackerPage() {
  return (
    <Page>
      <PageHeader title="Offer status watchdog" description="Track your own offers and get alerts when community reports suggest a trend worth knowing about." />
      <TrackerView />
    </Page>
  );
}
