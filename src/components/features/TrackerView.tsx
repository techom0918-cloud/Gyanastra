'use client';

import { Bell, ChevronDown, Clock, Info, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { findPersonalData } from '@/lib/privacy';
import { cn } from '@/lib/cn';
import { Alert as AlertType, OFFER_STATUS_LABELS, OfferStatus, TrackedOffer } from '@/types';
import { useSession } from '@/components/auth/AuthProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { Pill, StatusBadge } from '@/components/ui/StatusBadge';
import { useTracker } from './useTracker';
import type { NewOfferInput } from './useTracker';

const SEVERITY: Record<AlertType['severity'], string> = {
  high: 'border-red-200 bg-red-50 text-red-900',
  medium: 'border-amber-200 bg-amber-50 text-amber-900',
  low: 'border-brand-200 bg-brand-50 text-brand-800',
};

/** One community-informed alert. Not a live region: many alerts must not all be announced at once. */
export function OfferAlert({ alert }: { alert: AlertType }) {
  return (
    <div className={cn('rounded-xl border p-3.5', SEVERITY[alert.severity])}>
      <p className="text-sm font-semibold">
        <span className="sr-only">{alert.severity} priority: </span>
        {alert.title}
      </p>
      <p className="mt-1 text-sm leading-relaxed opacity-90">{alert.message}</p>
      <p className="mt-2 text-xs italic opacity-70">{alert.disclaimer}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

export function OfferCard({
  offer,
  onChangeStatus,
}: {
  offer: TrackedOffer;
  onChangeStatus?: (id: string, status: OfferStatus) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  const panelId = `offer-${offer.id}`;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-brand-50/60 sm:px-5"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-ink">{offer.companyName}</span>
            {offer.isDemo && <Pill tone="demo">Demo</Pill>}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {[offer.role, offer.expectedJoiningDate && `Expected ${offer.expectedJoiningDate}`].filter(Boolean).join(' · ') || 'No role or date added'}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={offer.currentStatus} />
            {offer.alerts.length > 0 && (
              <Pill tone="demo">
                {offer.alerts.length} alert{offer.alerts.length === 1 ? '' : 's'}
              </Pill>
            )}
          </span>
        </span>
        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div id={panelId} className="space-y-4 border-t border-line px-4 py-4 sm:px-5">
          <dl className="grid gap-3 sm:grid-cols-3">
            {offer.offerDate && <Detail label="Offer date" value={offer.offerDate} />}
            {offer.expectedJoiningDate && <Detail label="Expected joining" value={offer.expectedJoiningDate} />}
            {offer.lastCommunicationDate && <Detail label="Last communication" value={offer.lastCommunicationDate} />}
          </dl>
          {offer.notes && (
            <div>
              <p className="text-xs text-muted">Notes</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{offer.notes}</p>
            </div>
          )}

          {onChangeStatus && !offer.isDemo && (
            <div>
              <SelectField
                label="Update status"
                value={offer.currentStatus}
                disabled={saving}
                onChange={async (e) => {
                  setSaving(true);
                  setProblem('');
                  const result = await onChangeStatus(offer.id, e.target.value as OfferStatus);
                  if (!result.ok) setProblem(result.message ?? 'Could not update the status.');
                  setSaving(false);
                }}
                error={problem || undefined}
              >
                {(Object.keys(OFFER_STATUS_LABELS) as OfferStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {OFFER_STATUS_LABELS[s]}
                  </option>
                ))}
              </SelectField>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-muted">Community-informed alerts</p>
            {offer.alerts.length === 0 ? (
              <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                No community alerts right now. This does not guarantee a positive outcome.
              </p>
            ) : (
              <div className="space-y-2">
                {offer.alerts.map((a) => (
                  <OfferAlert key={a.id} alert={a} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

const EMPTY_FORM = { companyName: '', role: '', offerDate: '', expectedJoiningDate: '', currentStatus: 'offer_received' as OfferStatus, notes: '' };

function AddOfferForm({ onSubmit, onCancel }: { onSubmit: (input: NewOfferInput) => Promise<{ ok: boolean; message?: string; fieldErrors?: Record<string, string> }>; onCancel: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function check(): Record<string, string> {
    const e: Record<string, string> = {};
    if (form.companyName.trim().length < 2) e.companyName = 'Enter the company name (at least 2 characters).';
    for (const field of ['companyName', 'role', 'notes'] as const) {
      if (!e[field] && findPersonalData(form[field]).length > 0) e[field] = 'Please remove emails, phone numbers and ID numbers.';
    }
    if (form.notes.length > 1000) e.notes = 'Keep notes under 1000 characters.';
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    const found = check();
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    const result = await onSubmit({
      companyName: form.companyName.trim(),
      role: form.role.trim() || undefined,
      offerDate: form.offerDate || undefined,
      expectedJoiningDate: form.expectedJoiningDate || undefined,
      currentStatus: form.currentStatus,
      notes: form.notes.trim() || undefined,
    });
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setFormError(result.message ?? 'Could not save this offer.');
      setSaving(false);
    }
    // On success the parent closes the dialog.
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField label="Company name" required value={form.companyName} onChange={(e) => set('companyName', e.target.value)} error={errors.companyName} placeholder="e.g. Infosys" autoComplete="off" />
      <TextField label="Role" optional value={form.role} onChange={(e) => set('role', e.target.value)} error={errors.role} placeholder="e.g. Software Engineer" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Offer date" optional type="date" value={form.offerDate} onChange={(e) => set('offerDate', e.target.value)} />
        <TextField label="Expected joining date" optional type="date" value={form.expectedJoiningDate} onChange={(e) => set('expectedJoiningDate', e.target.value)} />
      </div>
      <SelectField label="Current status" value={form.currentStatus} onChange={(e) => set('currentStatus', e.target.value)}>
        {(Object.keys(OFFER_STATUS_LABELS) as OfferStatus[]).map((s) => (
          <option key={s} value={s}>
            {OFFER_STATUS_LABELS[s]}
          </option>
        ))}
      </SelectField>
      <TextAreaField label="Notes" optional rows={3} maxLength={1000} value={form.notes} onChange={(e) => set('notes', e.target.value)} error={errors.notes} hint="Keep it factual. No names, emails or phone numbers." />
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {saving ? 'Saving…' : 'Add offer'}
        </Button>
      </div>
    </form>
  );
}

/** Track Offer experience, shared by /tracker and /mobile/offers. */
export function TrackerView() {
  const { status } = useSession();
  const tracker = useTracker();
  const [adding, setAdding] = useState(false);

  const alerts = tracker.offers.flatMap((o) => o.alerts);
  const high = alerts.filter((a) => a.severity === 'high');
  const canAdd = tracker.scope !== 'account' || tracker.accountTracking;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {tracker.scope === 'account' ? 'Saved to your account.' : 'Saved only in this browser.'}
        </p>
        {canAdd && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Track an offer
          </Button>
        )}
      </div>

      {tracker.scope === 'browser' && status !== 'loading' && (
        <Alert tone="info" title="Offers you add are kept in this browser only">
          {status === 'unconfigured' ? (
            'Clearing site data removes them.'
          ) : (
            <>
              Clearing site data removes them.{' '}
              <Link href="/login?next=%2Ftracker" className="font-medium underline">
                Log in
              </Link>{' '}
              to keep offers with your account.
            </>
          )}
        </Alert>
      )}
      {tracker.scope === 'account' && !tracker.accountTracking && (
        <Alert tone="warning" title="Saving offers to your account is not enabled yet">
          The account feature needs a database update on this server. Your account works, but offers cannot be saved to it until that is done.
        </Alert>
      )}

      {high.length > 0 && (
        <Alert tone="error" title={`${high.length} high-priority alert${high.length === 1 ? '' : 's'}`}>
          <span className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" aria-hidden /> Open the offers below to read them.
          </span>
        </Alert>
      )}

      {tracker.loading && tracker.offers.length === 0 ? (
        <LoadingRegion label="Loading your offers" className="space-y-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </LoadingRegion>
      ) : tracker.error && tracker.offers.length === 0 ? (
        <Card>
          <ErrorState title="Could not load your offers" onRetry={tracker.reload} />
        </Card>
      ) : tracker.offers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Clock}
            title="No offers tracked yet"
            description="Add an offer to compare its status with community reports and get alerts."
            action={
              canAdd ? (
                <Button onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" aria-hidden /> Track your first offer
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {tracker.offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} onChangeStatus={tracker.updateStatus} />
          ))}
        </div>
      )}

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
        <strong>Note:</strong> Alerts come from community reports and simple rules. They are not predictions or guarantees. Always confirm with the company through official channels.
      </p>

      <Dialog open={adding} onClose={() => setAdding(false)} title="Track an offer" description="Add the offer you want to monitor.">
        <AddOfferForm
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            const result = await tracker.addOffer(input);
            if (result.ok) setAdding(false);
            return result;
          }}
        />
      </Dialog>
    </div>
  );
}
