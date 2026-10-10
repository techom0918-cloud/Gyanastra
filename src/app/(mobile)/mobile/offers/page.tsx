import type { Metadata } from 'next';
import { TrackerView } from '@/components/features/TrackerView';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Your offers' };

export default function MobileOffersPage() {
  return (
    <>
      <PageHeader title="Your offers" description="Track offers and see alerts from community reports." />
      <TrackerView />
    </>
  );
}
