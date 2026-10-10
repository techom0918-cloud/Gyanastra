'use client';

import { Bell, Brain, FilePlus2, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { OfferReport } from '@/types';
import { useSession } from '@/components/auth/AuthProvider';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { Pill, StatusBadge } from '@/components/ui/StatusBadge';
import { OfferAlert } from './TrackerView';
import { OfferSummaryRow } from './OfferSummary';
import { useTracker } from './useTracker';

interface DashboardData {
  stats: { total: number; companies: number; delayed: number; revoked: number; confirmed: number; demo?: number };
  recentReports: OfferReport[];
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

const QUICK_ACTIONS = [
  { href: '/reports', title: 'Submit a report', text: 'Share an offer outcome anonymously', icon: FilePlus2 },
  { href: '/tracker', title: 'Track an offer', text: 'Monitor status and get alerts', icon: Bell },
  { href: '/backup-planner', title: 'Backup planner', text: 'Plan your next few weeks', icon: Brain },
];

/** "Your offers": only rendered from a server-validated session; never shows another user's data or demo data. */
function PersonalSection() {
  const { status, user } = useSession();
  const tracker = useTracker(status === 'authenticated');

  if (status === 'loading') {
    return (
      <LoadingRegion label="Checking your session" className="mb-6">
        <Skeleton className="h-40 rounded-xl" />
      </LoadingRegion>
    );
  }
  if (status === 'unconfigured') return null;

  if (status === 'anonymous' || !user) {
    return (
      <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">See your own offers here</h2>
          <p className="mt-0.5 text-sm text-muted">Log in to keep tracked offers and alerts with your account.</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/login?next=%2Fdashboard" size="sm">
            <LogIn className="h-4 w-4" aria-hidden /> Log in
          </ButtonLink>
          <ButtonLink href="/signup?next=%2Fdashboard" variant="secondary" size="sm">
            Sign up
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const alerts = tracker.offers.flatMap((o) => o.alerts).sort((a, b) => ['high', 'medium', 'low'].indexOf(a.severity) - ['high', 'medium', 'low'].indexOf(b.severity));

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Your tracked offers"
          action={
            <Link href="/tracker" className="text-xs font-medium text-brand-700 hover:underline">
              Manage
            </Link>
          }
        />
        {tracker.loading && tracker.offers.length === 0 ? (
          <LoadingRegion label="Loading your offers" className="space-y-3 p-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </LoadingRegion>
        ) : tracker.error ? (
          <ErrorState title="Could not load your offers" onRetry={tracker.reload} />
        ) : !tracker.accountTracking ? (
          <EmptyState title="Account offers are not enabled yet" description="This server needs a database update before offers can be saved to accounts." />
        ) : tracker.offers.length === 0 ? (
          <EmptyState
            title="No offers tracked yet"
            description="Add an offer to compare its status with community reports."
            action={
              <ButtonLink href="/tracker" size="sm">
                Track an offer
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {tracker.offers.slice(0, 4).map((o) => (
              <li key={o.id}>
                <OfferSummaryRow offer={o} href="/tracker" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Alerts for your offers" description="From community reports and simple rules, not predictions." />
        {alerts.length === 0 ? (
          <EmptyState icon={Bell} title="No alerts right now" description="You will see community-informed alerts here when something relevant appears." />
        ) : (
          <div className="space-y-2 p-4">
            {alerts.slice(0, 3).map((a) => (
              <OfferAlert key={a.id} alert={a} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);

  const [attempt, setAttempt] = useState(0);

  // State is only set in promise callbacks; `attempt` re-runs the effect for retries.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error('failed');
        return res.json() as Promise<DashboardData>;
      })
      .then((next) => {
        if (!cancelled) setData(next);
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
    setData(null);
    setAttempt((n) => n + 1);
  }, []);

  return (
    <div>
      <PersonalSection />

      <h2 className="mb-3 text-sm font-semibold text-ink">Quick actions</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {QUICK_ACTIONS.map(({ href, title, text, icon: Icon }) => (
          <Link key={href} href={href} className="group flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand-300">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">{title}</span>
              <span className="mt-0.5 block text-xs text-muted">{text}</span>
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-ink">Community overview</h2>
      {error ? (
        <Card>
          <ErrorState title="Could not load the community overview" onRetry={load} />
        </Card>
      ) : !data ? (
        <LoadingRegion label="Loading the community overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </LoadingRegion>
      ) : (
        <>
          <dl className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Total reports" value={data.stats.total} />
            <Stat label="Companies" value={data.stats.companies} />
            <Stat label="Confirmed" value={data.stats.confirmed} />
            <Stat label="Delayed" value={data.stats.delayed} />
            <Stat label="Revoked" value={data.stats.revoked} />
          </dl>
          {(data.stats.demo ?? 0) > 0 && (
            <p className="mb-6 text-xs text-muted">
              {data.stats.demo} of {data.stats.total} reports are synthetic demo data, not real outcomes.
            </p>
          )}

          <Card className="mt-6">
            <CardHeader
              title="Recent reports"
              action={data.recentReports.some((r) => r.isDemo) ? <Pill tone="demo">Includes demo data</Pill> : undefined}
            />
            {data.recentReports.length === 0 ? (
              <EmptyState title="No reports yet" description="Be the first to share an outcome." action={<ButtonLink href="/reports" size="sm">Submit a report</ButtonLink>} />
            ) : (
              <ul className="divide-y divide-line">
                {data.recentReports.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link href={`/companies/${r.companySlug}`} className="truncate text-sm font-medium text-brand-700 hover:underline">
                        {r.companyName}
                      </Link>
                      {r.isDemo && <Pill tone="demo">Demo</Pill>}
                      {r.role && <span className="hidden truncate text-xs text-muted md:inline">· {r.role}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={r.status} />
                      <time className="text-xs text-muted" dateTime={r.reportedAt}>
                        {r.reportedAt}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/** First word of the user's name, for the greeting. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

/** Page title: a personal greeting for signed-in users, otherwise the plain title. Neutral until the session is known. */
export function DashboardHeading() {
  const { status, user } = useSession();
  return (
    <header className="mb-6 sm:mb-8">
      {status === 'loading' ? (
        <Skeleton className="h-9 w-64" />
      ) : (
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{user ? `Welcome back, ${firstName(user.name)}` : 'Dashboard'}</h1>
      )}
      <p className="mt-1.5 max-w-2xl text-sm text-muted sm:text-base">
        {user ? 'Your offers and alerts, plus what the community is reporting.' : 'Community-reported campus placement outcomes at a glance.'}
      </p>
    </header>
  );
}
