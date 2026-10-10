'use client';

import { CircleCheck, Send, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { describeSubmitFailure, mapServerErrors, validateReport } from '@/lib/report-validation';
import type { ReportFormErrors, ReportFormValues } from '@/lib/report-validation';
import { ClassificationResult, OFFER_STATUS_LABELS, OfferStatus } from '@/types';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { STATUS_STYLES } from '@/components/ui/status';
import { cn } from '@/lib/cn';

const EMPTY: ReportFormValues = { companyName: '', status: 'offer_received', description: '', role: '', graduationYear: '', delayWeeks: '' };

const STATUS_HINTS: Record<OfferStatus, string> = {
  offer_received: 'You have an offer; joining is not confirmed yet',
  bg_verification_pending: 'Waiting on background verification',
  joining_confirmed: 'Your joining date is confirmed',
  joining_delayed: 'Joining was pushed back or is unclear',
  offer_revoked: 'The company withdrew the offer',
};

const FIELD_IDS = { companyName: 'report-company', description: 'report-description', role: 'report-role', graduationYear: 'report-year', delayWeeks: 'report-delay' };

export function ReportForm({ companiesHref = '/companies' }: { companiesHref?: string }) {
  const [values, setValues] = useState<ReportFormValues>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<keyof ReportFormErrors, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<ReportFormErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submittingRef = useRef(false); // blocks a second submit in the same tick, before state has updated
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [classifying, setClassifying] = useState(false);

  const clientErrors = validateReport(values);
  const errorFor = (field: keyof ReportFormErrors) => ((attempted || touched[field]) && clientErrors[field]) || serverErrors[field];
  const set = <K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setServerErrors((e) => ({ ...e, [key]: undefined }));
  };
  const blur = (field: keyof ReportFormErrors) => setTouched((t) => ({ ...t, [field]: true }));
  const showDelay = values.status === 'joining_delayed' || Boolean(classification?.delayWeeks);

  async function suggest() {
    if (values.description.trim().length < 10 || classifying) return;
    setClassifying(true);
    setClassification(null);
    try {
      const res = await fetch('/api/classify-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: values.description }),
      });
      const data = await res.json();
      if (data.classification) setClassification(data.classification);
    } catch {
      // The suggestion is optional; failing quietly is fine.
    }
    setClassifying(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setAttempted(true);
    setFormError('');
    const problems = validateReport(values);
    const first = (Object.keys(FIELD_IDS) as (keyof ReportFormErrors)[]).find((k) => problems[k]);
    if (first) {
      requestAnimationFrame(() => document.getElementById(FIELD_IDS[first])?.focus());
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: values.companyName.trim(),
          status: values.status,
          description: values.description.trim() || undefined,
          role: values.role.trim() || undefined,
          graduationYear: values.graduationYear.trim() ? Number(values.graduationYear) : undefined,
          delayWeeks: showDelay && values.delayWeeks.trim() ? Number(values.delayWeeks) : undefined,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      const mapped = mapServerErrors(data.details);
      setServerErrors(mapped);
      if (Object.keys(mapped).length === 0) setFormError(describeSubmitFailure(res.status, res.headers.get('retry-after'), data.error));
      else setFormError('Please fix the highlighted fields.');
    } catch {
      setFormError('We could not reach the server. Check your connection and try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="p-6 text-center sm:p-8">
        <CircleCheck className="mx-auto h-11 w-11 text-emerald-600" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold text-ink">Report submitted</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          Thank you. Your report is anonymous and helps other students judge their own offers. It is shown as a community self-report and is not verified.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            onClick={() => {
              setSubmitted(false);
              setValues(EMPTY);
              setTouched({});
              setAttempted(false);
              setClassification(null);
            }}
          >
            Submit another
          </Button>
          <ButtonLink href={companiesHref} variant="secondary">
            View companies
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Alert tone="info" title="What is safe to share">
        <p>
          Company, role, status, dates and durations. <strong>Do not include</strong> names, email addresses, phone numbers, roll or registration
          numbers, offer letters or recruiter messages. Reports are anonymous and are checked for personal details before they are saved.
        </p>
      </Alert>

      <TextField
        id={FIELD_IDS.companyName}
        label="Company name"
        required
        placeholder="e.g. Infosys, TCS, Wipro"
        value={values.companyName}
        onChange={(e) => set('companyName', e.target.value)}
        onBlur={() => blur('companyName')}
        error={errorFor('companyName')}
        autoComplete="off"
      />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">
          Offer status <span className="text-red-600" aria-hidden>*</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(OFFER_STATUS_LABELS) as OfferStatus[]).map((s) => {
            const style = STATUS_STYLES[s];
            const selected = values.status === s;
            return (
              <label
                key={s}
                className={cn(
                  'relative flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border bg-surface p-3 transition-colors',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
                  selected ? `${style.selected} ring-1` : 'border-line-strong hover:border-brand-300'
                )}
              >
                <input type="radio" name="status" value={s} checked={selected} onChange={() => set('status', s)} className="sr-only" />
                <style.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{OFFER_STATUS_LABELS[s]}</span>
                  <span className={cn('block text-xs', selected ? 'opacity-80' : 'text-muted')}>{STATUS_HINTS[s]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <TextAreaField
          id={FIELD_IDS.description}
          label="What happened?"
          optional
          rows={4}
          maxLength={1000}
          counter={`${values.description.length}/1000`}
          placeholder="e.g. Offer in December; joining was due in July but has slipped by about 3 months with no clear update."
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          onBlur={() => blur('description')}
          error={errorFor('description')}
        />
        {values.description.trim().length >= 10 && (
          <div className="mt-2">
            <Button variant="ghost" size="sm" onClick={suggest} loading={classifying} className="-ml-3">
              <Sparkles className="h-4 w-4" aria-hidden /> {classifying ? 'Reading…' : 'Suggest a status from my text'}
            </Button>
          </div>
        )}
        {classification && (
          <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50 p-3.5" role="status">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={classification.proposedStatus} />
              <span className="text-xs text-muted">Match strength {(classification.confidence * 100).toFixed(0)}%</span>
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  set('status', classification.proposedStatus);
                  if (classification.delayWeeks) set('delayWeeks', String(classification.delayWeeks));
                }}
              >
                Use this status
              </Button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              {classification.summary} This is simple keyword matching, not AI and not a guarantee. Always check the status yourself.
            </p>
          </div>
        )}
      </div>

      {showDelay && (
        <TextField
          id={FIELD_IDS.delayWeeks}
          label="Estimated delay (weeks)"
          optional
          type="number"
          inputMode="numeric"
          min={0}
          max={200}
          placeholder="e.g. 12"
          value={values.delayWeeks}
          onChange={(e) => set('delayWeeks', e.target.value)}
          onBlur={() => blur('delayWeeks')}
          error={errorFor('delayWeeks')}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={FIELD_IDS.role}
          label="Role"
          optional
          placeholder="e.g. Software Engineer"
          value={values.role}
          onChange={(e) => set('role', e.target.value)}
          onBlur={() => blur('role')}
          error={errorFor('role')}
        />
        <TextField
          id={FIELD_IDS.graduationYear}
          label="Graduation year"
          optional
          type="number"
          inputMode="numeric"
          min={2015}
          max={2030}
          placeholder="e.g. 2026"
          value={values.graduationYear}
          onChange={(e) => set('graduationYear', e.target.value)}
          onBlur={() => blur('graduationYear')}
          error={errorFor('graduationYear')}
        />
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        <Send className="h-4 w-4" aria-hidden /> {submitting ? 'Submitting…' : 'Submit report'}
      </Button>
      <p className="text-center text-xs text-muted">
        By submitting you confirm the information is true to the best of your knowledge. No account is needed.{' '}
        <Link href="/methodology" className="underline">
          How reports are used
        </Link>
      </p>
    </form>
  );
}
