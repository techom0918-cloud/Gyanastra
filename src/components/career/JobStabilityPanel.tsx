'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { Pill } from '@/components/ui/StatusBadge';
import { FACTOR_KEYS, FACTOR_LABELS, type CareerProfile, type Emphasis, type ExitStage, type FactorKey, type JobStabilityResult, type Responsibilities, type StoredAssessment, type YesNoUnknown } from '@/lib/career/types';
import { BulletList, careerFetch, Disclaimer, EvidenceList, Section, toNumber, YesNoField } from './shared';

const EMPHASIS: Record<Emphasis, { label: string; tone: 'neutral' | 'demo' | 'brand' }> = {
  worth_exploring_first: { label: 'Worth exploring first', tone: 'brand' },
  also_reasonable: { label: 'Also reasonable', tone: 'neutral' },
  less_suited_right_now: { label: 'Less suited right now', tone: 'demo' },
};
const READING = { strength: 'Strength', concern: 'Concern', neutral: 'Neutral', unknown: 'Not rated' } as const;

function JobStabilityResultView({ result }: { result: JobStabilityResult }) {
  return (
    <div className="space-y-5">
      <p className="text-base font-semibold leading-snug text-ink">{result.headline}</p>
      <Section title="How you rated your job">
        <ul className="grid gap-2 sm:grid-cols-2">
          {result.factors.map((f) => (
            <li key={f.key} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
              <span className="text-ink">{f.label}</span>
              <span className="text-muted">
                {f.rating ? `${f.rating}/5 · ` : ''}
                {READING[f.reading]}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      {result.observations.length > 0 && (
        <Section title="What this is based on">
          <EvidenceList items={result.observations} />
        </Section>
      )}
      <Section title="Your options">
        <ul className="space-y-3">
          {result.options.map((o) => (
            <li key={o.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-ink">{o.title}</h4>
                <Pill tone={EMPHASIS[o.emphasis].tone}>{EMPHASIS[o.emphasis].label}</Pill>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{o.why}</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted">Things to weigh</p>
                  <BulletList items={o.considerations} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted">First steps</p>
                  <BulletList items={o.firstSteps} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Section>
      {result.practical.length > 0 && (
        <Section title="Practical considerations">
          <ul className="space-y-2">
            {result.practical.map((p, i) => (
              <li key={i} className="rounded-lg bg-canvas px-3 py-2.5 text-sm leading-relaxed text-ink">
                <span className="font-medium">{p.topic}: </span>
                {p.note}
                {p.concern && <span className="ml-1.5 font-medium text-amber-800">(worth planning for)</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {result.unknowns.length > 0 && (
        <Section title="What we do not know">
          <BulletList items={result.unknowns} />
        </Section>
      )}
      <Disclaimer>{result.disclaimer}</Disclaimer>
    </div>
  );
}

export function JobStabilityPanel({ profile, latest, onAssessed }: { profile: CareerProfile | null; latest: StoredAssessment<JobStabilityResult> | null; onAssessed: (a: StoredAssessment<JobStabilityResult>) => void }) {
  const [editing, setEditing] = useState(!latest);
  const [stage, setStage] = useState<ExitStage>('considering');
  const [ratings, setRatings] = useState<Partial<Record<FactorKey, string>>>({});
  const [topPriority, setTopPriority] = useState<FactorKey | ''>('');
  const [tenure, setTenure] = useState(profile?.tenureMonths !== undefined ? String(profile.tenureMonths) : '');
  const [runway, setRunway] = useState(profile?.financialRunwayMonths !== undefined ? String(profile.financialRunwayMonths) : '');
  const [notice, setNotice] = useState(profile?.noticePeriodDays !== undefined ? String(profile.noticePeriodDays) : '');
  const [alt, setAlt] = useState<YesNoUnknown>('unknown');
  const [resp, setResp] = useState<Responsibilities>('unknown');
  const [sinceLeaving, setSinceLeaving] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const ratingValues = Object.fromEntries(Object.entries(ratings).filter(([, v]) => v).map(([k, v]) => [k, Number(v)]));
    const res = await careerFetch<{ assessment: StoredAssessment<JobStabilityResult> }>('/api/career/assess', 'POST', {
      kind: 'job_stability',
      input: {
        stage,
        ratings: ratingValues,
        topPriority: topPriority || undefined,
        tenureMonths: stage === 'left' ? undefined : toNumber(tenure),
        runwayMonths: toNumber(runway),
        noticePeriodDays: stage === 'left' ? undefined : toNumber(notice),
        hasAlternativeOffer: stage === 'left' ? 'unknown' : alt,
        responsibilities: resp,
        monthsSinceLeaving: stage === 'left' ? toNumber(sinceLeaving) : undefined,
      },
    });
    setBusy(false);
    if (res.ok) {
      setErrors({});
      setEditing(false);
      onAssessed(res.data.assessment);
    } else {
      setErrors(res.fieldErrors);
      setError(Object.keys(res.fieldErrors).length > 0 ? 'Please fix the highlighted fields.' : res.message);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Job stability and exit planning"
        description="A balanced way to think through a possible change. It does not judge your decision or predict what you will do."
        action={latest && !editing ? <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Update my situation</Button> : undefined}
      />
      <div className="p-4 sm:p-5">
        {profile && profile.status !== 'employed' && !latest && (
          <Alert tone="info" className="mb-4" title="Designed for people who are working, or recently left a job">
            You can still use it, for example if you are weighing a current role. Setting your status to “Employed” in your profile also pre-fills tenure and notice period.
          </Alert>
        )}
        {editing ? (
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <SelectField label="Which best describes you?" required value={stage} onChange={(e) => setStage(e.target.value as ExitStage)}>
              <option value="considering">I am thinking about changing jobs</option>
              <option value="preparing">I am preparing to leave</option>
              <option value="left">I have already left</option>
            </SelectField>

            <fieldset>
              <legend className="mb-1 text-sm font-medium text-ink">{stage === 'left' ? 'Thinking about the role you left' : 'How is your current job?'} <span className="font-normal text-muted">(1 = poor, 5 = very good)</span></legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FACTOR_KEYS.map((k) => (
                  <SelectField key={k} label={FACTOR_LABELS[k]} value={ratings[k] ?? ''} onChange={(e) => setRatings((r) => ({ ...r, [k]: e.target.value }))} error={errors[`ratings.${k}`]}>
                    <option value="">Not sure</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </SelectField>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="What matters most right now?" optional value={topPriority} onChange={(e) => setTopPriority(e.target.value as FactorKey | '')}>
                <option value="">No single priority</option>
                {FACTOR_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {FACTOR_LABELS[k]}
                  </option>
                ))}
              </SelectField>
              {stage !== 'left' && <TextField label="Months in this job" optional type="number" inputMode="numeric" min={0} max={600} value={tenure} onChange={(e) => setTenure(e.target.value)} error={errors.tenureMonths} />}
              {stage === 'left' && <TextField label="Months since you left" optional type="number" inputMode="numeric" min={0} max={120} value={sinceLeaving} onChange={(e) => setSinceLeaving(e.target.value)} error={errors.monthsSinceLeaving} />}
              <TextField label="Savings runway (months of expenses)" optional type="number" inputMode="decimal" min={0} max={120} step="0.5" hint="Only used to tailor the practical notes." value={runway} onChange={(e) => setRunway(e.target.value)} error={errors.runwayMonths} />
              {stage !== 'left' && <TextField label="Notice period (days)" optional type="number" inputMode="numeric" min={0} max={365} value={notice} onChange={(e) => setNotice(e.target.value)} error={errors.noticePeriodDays} />}
              {stage !== 'left' && <YesNoField label="Do you have a confirmed alternative offer?" value={alt} onChange={setAlt} />}
              <SelectField label="Financial responsibilities" optional value={resp} onChange={(e) => setResp(e.target.value as Responsibilities)}>
                <option value="unknown">Prefer not to say</option>
                <option value="none">Few or none</option>
                <option value="some">Some</option>
                <option value="significant">Significant</option>
              </SelectField>
            </div>

            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={busy}>
                {busy ? 'Working…' : 'Show my options'}
              </Button>
              {latest && (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        ) : latest ? (
          <div className="space-y-3">
            <p className="text-xs text-muted">Last updated {new Date(latest.createdAt).toLocaleDateString()}</p>
            <JobStabilityResultView result={latest.result} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
