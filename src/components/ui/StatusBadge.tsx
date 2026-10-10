import { OFFER_STATUS_LABELS, OfferStatus } from '@/types';
import { cn } from '@/lib/cn';
import { STATUS_STYLES } from './status';

/** Offer status as icon + label (never colour alone). */
export function StatusBadge({ status, className }: { status: OfferStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  const Icon = style.icon;
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', style.badge, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{OFFER_STATUS_LABELS[status]}</span>
    </span>
  );
}

/** Small neutral or toned label, e.g. "Demo data". */
export function Pill({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'demo' | 'brand'; children: React.ReactNode; className?: string }) {
  const tones = {
    neutral: 'bg-canvas text-ink-soft ring-line-strong',
    demo: 'bg-amber-50 text-amber-800 ring-amber-200',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  } as const;
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>{children}</span>;
}
