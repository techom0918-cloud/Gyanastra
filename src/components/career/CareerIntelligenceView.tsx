'use client';

// Career Intelligence container: loads the signed-in user's overview and shows four separate cards as tabs.
// Offer risk and job stability are deliberately independent assessments; nothing combines them into one score.
import { Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import type { ActionPlanResult, CareerOverview, CareerProfile, JobStabilityResult, OfferRiskResult, StoredAssessment } from '@/lib/career/types';
import { ActionPlanPanel } from './ActionPlanPanel';
import { JobStabilityPanel } from './JobStabilityPanel';
import { OfferRiskPanel } from './OfferRiskPanel';
import { ProfilePanel } from './ProfilePanel';
import { careerFetch } from './shared';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'offer', label: 'Offer check' },
  { id: 'stability', label: 'Job stability' },
  { id: 'plan', label: 'Action plan' },
] as const;
type TabId = (typeof TABS)[number]['id'];

type Load = { kind: 'loading' } | { kind: 'error'; status: number; message: string } | { kind: 'ready'; data: CareerOverview };

export function CareerIntelligenceView() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<TabId>('profile');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // State is only set in promise callbacks; `attempt` re-runs the effect for retries.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/career', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res): Promise<Load> => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { kind: 'error', status: res.status, message: typeof body.error === 'string' ? body.error : 'Could not load your career data.' };
        return { kind: 'ready', data: body as CareerOverview };
      })
      .catch((): Load => ({ kind: 'error', status: 0, message: 'We could not reach the server. Check your connection and try again.' }))
      .then((next) => {
        if (cancelled) return;
        setLoad(next);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const update = (fn: (d: CareerOverview) => CareerOverview) => setLoad((l) => (l.kind === 'ready' ? { kind: 'ready', data: fn(l.data) } : l));

  async function deleteAll() {
    setDeleting(true);
    setDeleteError('');
    const res = await careerFetch('/api/career', 'DELETE');
    setDeleting(false);
    if (!res.ok) return setDeleteError(res.message);
    setConfirmDelete(false);
    setTab('profile');
    update((d) => ({ ...d, profile: null, offerRisk: null, jobStability: null, actionPlan: null }));
  }

  function onTabKey(e: KeyboardEvent, index: number) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : step ? (index + step + TABS.length) % TABS.length : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  }

  if (load.kind === 'loading') {
    return (
      <LoadingRegion label="Loading your career data" className="space-y-4">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </LoadingRegion>
    );
  }
  if (load.kind === 'error') {
    const notEnabled = load.status === 503;
    return (
      <Card>
        <ErrorState
          title={notEnabled ? 'Career Intelligence is not available yet' : 'Could not load Career Intelligence'}
          description={notEnabled ? 'This feature has not been switched on for this site yet. Please check back later.' : load.message}
          onRetry={notEnabled ? undefined : () => { setLoad({ kind: 'loading' }); setAttempt((n) => n + 1); }}
        />
      </Card>
    );
  }

  const { data } = load;
  const hasData = Boolean(data.profile || data.offerRisk || data.jobStability || data.actionPlan);

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Career Intelligence sections" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-card">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[t.id] = el; }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={cn('min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors', tab === t.id ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-brand-50/70 hover:text-ink')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="focus:outline-none">
        {tab === 'profile' && <ProfilePanel profile={data.profile} onSaved={(p: CareerProfile) => update((d) => ({ ...d, profile: p }))} />}
        {tab === 'offer' && <OfferRiskPanel latest={data.offerRisk} onAssessed={(a: StoredAssessment<OfferRiskResult>) => update((d) => ({ ...d, offerRisk: a }))} />}
        {tab === 'stability' && <JobStabilityPanel profile={data.profile} latest={data.jobStability} onAssessed={(a: StoredAssessment<JobStabilityResult>) => update((d) => ({ ...d, jobStability: a }))} />}
        {tab === 'plan' && (
          <ActionPlanPanel
            profile={data.profile}
            latest={data.actionPlan}
            aiAvailable={data.aiAvailable}
            onPlan={(a: StoredAssessment<ActionPlanResult>) => update((d) => ({ ...d, actionPlan: a }))}
            onProgress={(taskId, done) =>
              update((d) => {
                if (!d.actionPlan) return d;
                const ids = new Set(d.actionPlan.completedTaskIds ?? []);
                if (done) ids.add(taskId);
                else ids.delete(taskId);
                return { ...d, actionPlan: { ...d.actionPlan, completedTaskIds: [...ids] } };
              })
            }
          />
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-sm shadow-card sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted">Your career data is private to your account. We keep only your latest 10 assessments of each type.</p>
        {hasData && (
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete my career data
          </Button>
        )}
      </div>

      <Dialog open={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)} title="Delete all career data?" description="This permanently deletes your career profile, assessments and plan progress. It cannot be undone. Your account and tracked offers are not affected.">
        {deleteError && <Alert tone="error" className="mb-3">{deleteError}</Alert>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={deleteAll} loading={deleting}>
            Delete everything
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
