'use client';

import { ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Company, OfferReport } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { Pill, StatusBadge } from '@/components/ui/StatusBadge';
import { ButtonLink } from '@/components/ui/Button';
import { BasisPill, DistributionBar, DistributionLegend, ReliabilityChip } from './Reliability';

type LoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'notfound' } | { kind: 'ready'; company: Company; reports: OfferReport[] };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-canvas px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

export function CompanyDetailView({ slug, backHref = '/companies' }: { slug: string; backHref?: string }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const [attempt, setAttempt] = useState(0);

  // State is only set in promise callbacks; `attempt` re-runs the effect for retries.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/companies/${encodeURIComponent(slug)}`)
      .then(async (res): Promise<LoadState> => {
        if (res.status === 404) return { kind: 'notfound' };
        if (!res.ok) throw new Error('failed');
        const data = (await res.json()) as { company: Company; reports: OfferReport[] };
        return { kind: 'ready', company: data.company, reports: data.reports };
      })
      .catch((): LoadState => ({ kind: 'error' }))
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const back = (
    <Link href={backHref} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden /> All companies
    </Link>
  );

  if (state.kind === 'loading') {
    return (
      <div>
        {back}
        <LoadingRegion label="Loading company" className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </LoadingRegion>
      </div>
    );
  }
  if (state.kind === 'notfound') {
    return (
      <div>
        {back}
        <Card>
          <EmptyState
            title="Company not found"
            description="There are no reports for this company yet."
            action={
              <ButtonLink href="/reports" variant="secondary" size="sm">
                Submit a report
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div>
        {back}
        <Card>
          <ErrorState title="Could not load this company" onRetry={load} />
        </Card>
      </div>
    );
  }

  const { company, reports } = state;
  const ri = company.reliabilityIndicator;

  return (
    <div className="space-y-5">
      <div>{back}</div>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{company.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {company.reportCount} report{company.reportCount === 1 ? '' : 's'}
              {company.latestReportDate && ` · latest ${company.latestReportDate}`}
            </p>
            <div className="mt-2">
              <BasisPill indicator={ri} />
            </div>
          </div>
          <ReliabilityChip indicator={ri} />
        </div>
      </Card>

      <Card>
        <CardHeader title="How this indicator was calculated" />
        <div className="space-y-4 p-4 sm:p-5">
          <p className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
            <span>{ri.explanation}</span>
          </p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Total reports" value={ri.totalReports} />
            <Stat label="Scored outcomes" value={ri.scoredOutcomes} />
            <Stat label="In progress (not scored)" value={ri.inProgressReports} />
            <Stat label="Recent outcomes (183 days)" value={ri.recentOutcomes} />
          </dl>
          <p className="text-xs text-muted">
            Evidence: {ri.evidence.verified} verified · {ri.evidence.publicUnverified} public, unverified · {ri.evidence.community} community self-reported.
            {ri.weightedPositiveShare !== null && ` Weighted share of confirmed outcomes: ${(ri.weightedPositiveShare * 100).toFixed(0)}%.`}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Status distribution" />
        <div className="space-y-3 p-4 sm:p-5">
          <DistributionBar distribution={company.statusDistribution} total={company.reportCount} className="h-3" />
          <DistributionLegend distribution={company.statusDistribution} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`All reports (${reports.length})`}
          action={reports.some((r) => r.isDemo) ? <Pill tone="demo">Includes demo data</Pill> : undefined}
        />
        {reports.length === 0 ? (
          <EmptyState
            title="No reports yet"
            action={
              <ButtonLink href="/reports" variant="secondary" size="sm">
                Submit a report
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {reports.map((r) => (
              <li key={r.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.status} />
                      {r.role && <span className="text-xs text-muted">{r.role}</span>}
                      {r.graduationYear && <span className="text-xs text-muted">Class of {r.graduationYear}</span>}
                      {r.isDemo && <Pill tone="demo">Demo</Pill>}
                    </div>
                    {r.description && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.description}</p>}
                    {r.delayWeeks != null && r.delayWeeks > 0 && (
                      <p className="mt-1 text-xs text-orange-700">
                        Reported delay: about {r.delayWeeks} week{r.delayWeeks === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  <time className="shrink-0 text-xs text-muted" dateTime={r.reportedAt}>
                    {r.reportedAt}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
        <strong>Disclaimer:</strong> Unless marked verified, reports are self-reported or unverified. The score summarises reports; it is not a
        probability that any individual offer will be honoured. An absence of negative reports does not guarantee a positive outcome. See the{' '}
        <Link href="/methodology" className="font-medium underline">
          methodology
        </Link>
        .
      </p>
    </div>
  );
}
