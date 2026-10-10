import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { TrackedOffer } from '@/types';
import { Pill, StatusBadge } from '@/components/ui/StatusBadge';

/** Compact row for a tracked offer: company, role, expected date, status and alert count. */
export function OfferSummaryRow({ offer, href }: { offer: TrackedOffer; href: string }) {
  const meta = [offer.role, offer.expectedJoiningDate && `Expected ${offer.expectedJoiningDate}`].filter(Boolean).join(' · ');
  return (
    <Link href={href} className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-brand-50/60 sm:px-5">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{offer.companyName}</span>
        <span className="mt-0.5 block truncate text-xs text-muted">{meta || 'No role or date added'}</span>
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={offer.currentStatus} />
          {offer.alerts.length > 0 && (
            <Pill tone="demo">
              {offer.alerts.length} alert{offer.alerts.length === 1 ? '' : 's'}
            </Pill>
          )}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
