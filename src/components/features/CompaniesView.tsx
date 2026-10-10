'use client';

// Searchable company directory, used by /companies and /mobile/companies (`basePath` sets where rows link to).
import { Building2, ChevronRight, Search, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Company } from '@/types';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { BasisPill, DistributionBar, ReliabilityChip } from './Reliability';

export function CompaniesView({ basePath = '/companies' }: { basePath?: string }) {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  const [attempt, setAttempt] = useState(0);

  // State is only set in promise callbacks (never synchronously in the effect); `attempt` re-runs it for retries.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/companies')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load companies');
        return res.json() as Promise<{ companies: Company[] }>;
      })
      .then((data) => {
        if (!cancelled) setCompanies(data.companies);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const load = useCallback(() => {
    setError(false);
    setCompanies(null);
    setAttempt((n) => n + 1);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (companies ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [companies, search]);

  return (
    <div>
      <div className="relative mb-4">
        <label htmlFor="company-search" className="sr-only">
          Search companies
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="company-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies"
          autoComplete="off"
          className="block h-11 w-full rounded-lg border border-line-strong bg-surface pl-10 pr-3 text-base text-ink shadow-card placeholder:text-muted/70 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:text-sm"
        />
      </div>

      {error ? (
        <Card>
          <ErrorState title="Could not load companies" description="Check your connection and try again." onRetry={load} />
        </Card>
      ) : companies === null ? (
        <LoadingRegion label="Loading companies" className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </LoadingRegion>
      ) : companies.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title="No company data yet" description="Reports will appear here once they are submitted." />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={SearchX} title="No companies match your search" description="Try a different spelling or clear the search box." />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {filtered.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`${basePath}/${c.slug}`}
                  className="group block rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-ink">{c.name}</h3>
                      <p className="mt-0.5 text-xs text-muted">
                        {c.reportCount} report{c.reportCount === 1 ? '' : 's'}
                        {c.latestReportDate && ` · latest ${c.latestReportDate}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <BasisPill indicator={c.reliabilityIndicator} />
                      <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </div>
                  </div>
                  <ReliabilityChip indicator={c.reliabilityIndicator} className="mt-3" />
                  <DistributionBar distribution={c.statusDistribution} total={c.reportCount} className="mt-3" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
        <strong>Read scores with care.</strong> Most reports are self-reported and unverified, and sample sizes are small. A greyed score has low
        confidence. Demo data is labelled and never mixed with real reports. See the{' '}
        <Link href="/methodology" className="font-medium underline">
          methodology
        </Link>{' '}
        for how scores are calculated; they are not probabilities.
      </p>
    </div>
  );
}
