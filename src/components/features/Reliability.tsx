// How reliability indicators are shown. The score is only ever presented together with its sample size and
// confidence, and a low-confidence score is deliberately muted (grey, dashed) so it cannot look authoritative.
import { OFFER_STATUS_LABELS, OfferStatus, ReliabilityIndicator } from '@/types';
import { Pill } from '@/components/ui/StatusBadge';
import { STATUS_STYLES } from '@/components/ui/status';
import { cn } from '@/lib/cn';

const LABEL_TONE: Record<ReliabilityIndicator['label'], string> = {
  'Insufficient Data': 'bg-canvas text-muted ring-line-strong',
  'Caution Advised': 'bg-red-50 text-red-800 ring-red-200',
  'Mixed Reports': 'bg-amber-50 text-amber-800 ring-amber-200',
  'Mostly Positive': 'bg-brand-50 text-brand-700 ring-brand-200',
  'Highly Positive': 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

export const CONFIDENCE_TEXT: Record<ReliabilityIndicator['confidence'], string> = {
  insufficient: 'Not enough data to score',
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
};

export function describeIndicator(ri: ReliabilityIndicator): string {
  if (ri.score === null) return `No reliability score yet: ${CONFIDENCE_TEXT[ri.confidence].toLowerCase()}, ${ri.scoredOutcomes} scored outcomes`;
  return `Reliability score ${ri.score} out of 100, ${ri.label}, ${CONFIDENCE_TEXT[ri.confidence].toLowerCase()}, based on ${ri.scoredOutcomes} scored outcomes`;
}

export function ReliabilityChip({ indicator: ri, className }: { indicator: ReliabilityIndicator; className?: string }) {
  const muted = ri.confidence === 'insufficient' || ri.confidence === 'low';
  return (
    <div className={cn('flex items-center gap-3', className)} role="group" aria-label={describeIndicator(ri)}>
      <span
        aria-hidden
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-semibold tabular-nums ring-1 ring-inset',
          ri.score === null || muted ? 'border border-dashed border-line-strong bg-canvas text-ink-soft ring-transparent' : LABEL_TONE[ri.label]
        )}
      >
        {ri.score ?? '–'}
      </span>
      <div className="min-w-0" aria-hidden>
        <p className={cn('truncate text-sm font-medium', muted ? 'text-ink-soft' : 'text-ink')}>{ri.label}</p>
        <p className="text-xs text-muted">
          {CONFIDENCE_TEXT[ri.confidence]} · {ri.scoredOutcomes} scored outcome{ri.scoredOutcomes === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}

/** Badges for the basis of a score (demo data is never presented as real evidence). */
export function BasisPill({ indicator }: { indicator: ReliabilityIndicator }) {
  return indicator.basis === 'demo' ? <Pill tone="demo">Demo data</Pill> : null;
}

export function DistributionBar({ distribution, total, className }: { distribution: Partial<Record<OfferStatus, number>>; total: number; className?: string }) {
  const entries = (Object.keys(OFFER_STATUS_LABELS) as OfferStatus[]).filter((s) => (distribution[s] ?? 0) > 0);
  const summary = entries.map((s) => `${OFFER_STATUS_LABELS[s]}: ${distribution[s]}`).join(', ');
  return (
    <div
      role="img"
      aria-label={`Status distribution of ${total} reports. ${summary}`}
      className={cn('flex h-2 w-full gap-px overflow-hidden rounded-full bg-line', className)}
    >
      {entries.map((s) => (
        <span key={s} className={STATUS_STYLES[s].solid} style={{ width: `${((distribution[s] ?? 0) / total) * 100}%` }} />
      ))}
    </div>
  );
}

export function DistributionLegend({ distribution }: { distribution: Partial<Record<OfferStatus, number>> }) {
  const entries = (Object.keys(OFFER_STATUS_LABELS) as OfferStatus[]).filter((s) => (distribution[s] ?? 0) > 0);
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {entries.map((s) => (
        <li key={s} className="flex items-center gap-1.5 text-xs text-muted">
          <span className={cn('h-2 w-2 rounded-full', STATUS_STYLES[s].solid)} aria-hidden />
          {OFFER_STATUS_LABELS[s]}: {distribution[s]}
        </li>
      ))}
    </ul>
  );
}
