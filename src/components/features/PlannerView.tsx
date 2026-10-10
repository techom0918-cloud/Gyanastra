'use client';

import { BookOpen, Briefcase, Brain, Calendar, MessageSquare, Sparkles, Target } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { findPersonalData } from '@/lib/privacy';
import { cn } from '@/lib/cn';
import { GeneratedPlan, OFFER_STATUS_LABELS, OfferStatus } from '@/types';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Pill } from '@/components/ui/StatusBadge';

interface PlanResponse {
  plan: GeneratedPlan;
  isAIGenerated?: boolean;
  fallbackReason?: 'not_configured' | 'rate_limited' | 'ai_unavailable';
}

const FALLBACK_TEXT: Record<string, string> = {
  not_configured: 'AI is not enabled on this server, so this plan comes from a rule-based template.',
  rate_limited: 'You have requested several AI plans recently, so this one comes from the rule-based template.',
  ai_unavailable: 'The AI service was unavailable, so this plan comes from the rule-based template.',
};

const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

function Section({ icon: Icon, title, tone, children }: { icon: typeof Target; title: string; tone: string; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tone)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PlanResult({ result, onReset }: { result: PlanResponse; onReset: () => void }) {
  const { plan } = result;
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onReset} className="-ml-3">
        ← Create a new plan
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        {result.isAIGenerated ? <Pill tone="brand">AI-generated guidance (Claude)</Pill> : <Pill>Rule-based template, no AI</Pill>}
      </div>
      {!result.isAIGenerated && result.fallbackReason && <p className="text-xs text-muted">{FALLBACK_TEXT[result.fallbackReason]}</p>}

      <Card className="border-brand-200 bg-brand-50 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-800">
          <Brain className="h-4 w-4" aria-hidden /> Your situation
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-brand-800">{plan.scenario}</p>
      </Card>

      <Section icon={Target} title="Immediate actions" tone="bg-red-50 text-red-700">
        <ol className="space-y-2">
          {plan.immediateActions.map((a, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
              <span className="w-5 shrink-0 font-semibold text-red-600 tabular-nums">{i + 1}.</span>
              <span>{a}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section icon={Calendar} title="Four-week plan" tone="bg-brand-50 text-brand-700">
        <div className="space-y-4">
          {plan.weeklyGoals.map((w) => (
            <div key={w.week} className="border-l-2 border-brand-200 pl-4">
              <p className="mb-1 text-sm font-semibold text-brand-700">Week {w.week}</p>
              <Bullets items={w.goals} />
            </div>
          ))}
        </div>
      </Section>

      <Section icon={BookOpen} title="Skills to develop" tone="bg-emerald-50 text-emerald-700">
        <div className="space-y-3">
          {plan.skillsToImprove.map((s, i) => (
            <div key={i} className="rounded-lg bg-canvas p-3.5">
              <p className="text-sm font-semibold text-ink">{s.skill}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{s.reason}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {s.resources.map((r, j) => (
                  <li key={j} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Briefcase} title="Application strategy" tone="bg-orange-50 text-orange-700">
        <Bullets items={plan.applicationStrategy} />
      </Section>

      <Section icon={MessageSquare} title="Interview preparation" tone="bg-indigo-50 text-indigo-700">
        <Bullets items={plan.interviewPrep} />
      </Section>

      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
        <strong>Disclaimer:</strong> {plan.disclaimer}
      </p>
    </div>
  );
}

export function PlannerView() {
  const [skills, setSkills] = useState('');
  const [degree, setDegree] = useState('');
  const [preferredRole, setPreferredRole] = useState('');
  const [locations, setLocations] = useState('');
  const [currentOfferStatus, setStatus] = useState<OfferStatus>('joining_delayed');
  const [expectedJoiningDate, setDate] = useState('');
  const [companyName, setCompany] = useState('');
  const [additionalContext, setContext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<PlanResponse | null>(null);

  function check() {
    const e: Record<string, string> = {};
    const skillList = split(skills);
    if (skillList.length === 0) e.skills = 'Add at least one skill, separated by commas.';
    else if (skillList.length > 20) e.skills = 'Add 20 skills at most.';
    else if (skillList.some((s) => s.length > 100)) e.skills = 'Each skill should be under 100 characters.';
    if (!degree.trim()) e.degree = 'Enter your degree.';
    if (!preferredRole.trim()) e.preferredRole = 'Enter the role you want.';
    if (split(locations).length > 10) e.locations = 'List 10 locations at most.';
    if (additionalContext.length > 500) e.additionalContext = 'Keep this under 500 characters.';
    const pii = { skills, degree, preferredRole, locations, companyName, additionalContext };
    for (const [k, v] of Object.entries(pii)) {
      if (!e[k] && findPersonalData(v).length > 0) e[k] = 'Please remove emails, phone numbers and ID numbers.';
    }
    return e;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (generating) return;
    const found = check();
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/backup-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: split(skills),
          degree: degree.trim(),
          preferredRole: preferredRole.trim(),
          locationPreferences: split(locations),
          currentOfferStatus,
          expectedJoiningDate: expectedJoiningDate || undefined,
          companyName: companyName.trim() || undefined,
          additionalContext: additionalContext.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? 'Failed to generate a plan.');
        if (data.details && typeof data.details === 'object') {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.details)) if (Array.isArray(v) && typeof v[0] === 'string') mapped[k] = v[0];
          setErrors(mapped);
        }
        return;
      }
      setResult(data as PlanResponse);
      window.scrollTo({ top: 0 });
    } catch {
      setFormError('We could not reach the server. Check your connection and try again.');
    } finally {
      setGenerating(false);
    }
  }

  if (result) return <PlanResult result={result} onReset={() => setResult(null)} />;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Alert tone="info" title="Before you start">
        Don&apos;t include names, emails or phone numbers. When AI is enabled, your answers (except the company name) are sent to an AI provider to write the plan.
      </Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Skills" required value={skills} onChange={(e) => setSkills(e.target.value)} error={errors.skills} hint="Comma-separated, e.g. Python, SQL, React" className="sm:col-span-2" />
        <TextField label="Degree" required value={degree} onChange={(e) => setDegree(e.target.value)} error={errors.degree} placeholder="e.g. B.Tech Computer Science" />
        <TextField label="Preferred role" required value={preferredRole} onChange={(e) => setPreferredRole(e.target.value)} error={errors.preferredRole} placeholder="e.g. Full-stack developer" />
        <TextField label="Location preferences" optional value={locations} onChange={(e) => setLocations(e.target.value)} error={errors.locations} hint="Comma-separated, e.g. Bangalore, Remote" />
        <SelectField label="Current offer status" required value={currentOfferStatus} onChange={(e) => setStatus(e.target.value as OfferStatus)}>
          {(Object.keys(OFFER_STATUS_LABELS) as OfferStatus[]).map((s) => (
            <option key={s} value={s}>
              {OFFER_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <TextField label="Expected joining date" optional type="date" value={expectedJoiningDate} onChange={(e) => setDate(e.target.value)} />
        <TextField label="Company" optional value={companyName} onChange={(e) => setCompany(e.target.value)} error={errors.companyName} placeholder="Not sent to the AI" hint="Used only to personalise the page; never sent to the AI provider." />
      </div>
      <TextAreaField
        label="Anything else we should know?"
        optional
        rows={3}
        maxLength={500}
        counter={`${additionalContext.length}/500`}
        value={additionalContext}
        onChange={(e) => setContext(e.target.value)}
        error={errors.additionalContext}
        placeholder="e.g. A 3-month gap since graduation; I'd like to focus on startups."
      />
      {formError && <Alert tone="error">{formError}</Alert>}
      <Button type="submit" size="lg" fullWidth loading={generating}>
        <Sparkles className="h-4 w-4" aria-hidden /> {generating ? 'Generating your plan…' : 'Generate backup plan'}
      </Button>
      <p className="text-center text-xs text-muted">
        Plans are general career guidance. They contain no verified facts about any company and do not predict whether an offer will be honoured.
      </p>
    </form>
  );
}
