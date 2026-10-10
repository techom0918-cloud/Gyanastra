'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import {
  CAREER_STATUSES,
  CAREER_STATUS_LABELS,
  FACTOR_KEYS,
  FACTOR_LABELS,
  PRIORITY_KEYS,
  PRIORITY_LABELS,
  type CareerProfile,
  type CareerStatus,
  type FactorKey,
  type PriorityKey,
} from '@/lib/career/types';
import { careerFetch, CheckboxGroup, fromList, toList, toNumber } from './shared';

interface Values {
  status: CareerStatus;
  currentJobTitle: string;
  targetRole: string;
  industry: string;
  experienceMonths: string;
  tenureMonths: string;
  skills: string;
  growthSkills: string;
  goals: string;
  priorities: PriorityKey[];
  salaryMinLpa: string;
  salaryMaxLpa: string;
  preferredLocations: string;
  concerns: FactorKey[];
  exitReasons: FactorKey[];
  noticePeriodDays: string;
  financialRunwayMonths: string;
}

const str = (n: number | undefined) => (n === undefined ? '' : String(n));

function fromProfile(p: CareerProfile | null): Values {
  return {
    status: p?.status ?? 'student',
    currentJobTitle: p?.currentJobTitle ?? '',
    targetRole: p?.targetRole ?? '',
    industry: p?.industry ?? '',
    experienceMonths: str(p?.experienceMonths),
    tenureMonths: str(p?.tenureMonths),
    skills: fromList(p?.skills),
    growthSkills: fromList(p?.growthSkills),
    goals: p?.goals ?? '',
    priorities: p?.priorities ?? [],
    salaryMinLpa: str(p?.salaryMinLpa),
    salaryMaxLpa: str(p?.salaryMaxLpa),
    preferredLocations: fromList(p?.preferredLocations),
    concerns: p?.concerns ?? [],
    exitReasons: p?.exitReasons ?? [],
    noticePeriodDays: str(p?.noticePeriodDays),
    financialRunwayMonths: str(p?.financialRunwayMonths),
  };
}

const FACTOR_OPTIONS = FACTOR_KEYS.map((value) => ({ value, label: FACTOR_LABELS[value] }));
const PRIORITY_OPTIONS = PRIORITY_KEYS.map((value) => ({ value, label: PRIORITY_LABELS[value] }));

export function ProfilePanel({ profile, onSaved }: { profile: CareerProfile | null; onSaved: (p: CareerProfile) => void }) {
  const [v, setV] = useState<Values>(() => fromProfile(profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
    setMessage(null);
  };
  const employed = v.status === 'employed';
  const working = v.status !== 'student';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(null);
    const res = await careerFetch<{ profile: CareerProfile }>('/api/career/profile', 'PUT', {
      status: v.status,
      currentJobTitle: v.currentJobTitle,
      targetRole: v.targetRole,
      industry: v.industry,
      experienceMonths: working ? toNumber(v.experienceMonths) : undefined,
      tenureMonths: employed ? toNumber(v.tenureMonths) : undefined,
      skills: toList(v.skills),
      growthSkills: toList(v.growthSkills),
      goals: v.goals,
      priorities: v.priorities,
      salaryMinLpa: toNumber(v.salaryMinLpa),
      salaryMaxLpa: toNumber(v.salaryMaxLpa),
      preferredLocations: toList(v.preferredLocations),
      concerns: v.concerns,
      exitReasons: employed ? v.exitReasons : [],
      noticePeriodDays: employed ? toNumber(v.noticePeriodDays) : undefined,
      financialRunwayMonths: toNumber(v.financialRunwayMonths),
    });
    setSaving(false);
    if (res.ok) {
      setErrors({});
      setMessage({ tone: 'success', text: 'Profile saved.' });
      onSaved(res.data.profile);
    } else {
      setErrors(res.fieldErrors);
      setMessage({ tone: 'error', text: Object.keys(res.fieldErrors).length > 0 ? 'Please fix the highlighted fields.' : res.message });
    }
  }

  return (
    <Card>
      <CardHeader title="Your career profile" description="Only your status is required. Everything else helps tailor suggestions and can be left blank." />
      <form onSubmit={onSubmit} className="space-y-5 p-4 sm:p-5" noValidate>
        <SelectField label="Where are you right now?" required value={v.status} onChange={(e) => set('status', e.target.value as CareerStatus)}>
          {CAREER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CAREER_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>

        <div className="grid gap-4 sm:grid-cols-2">
          {working && <TextField label="Current or most recent job title" optional maxLength={100} value={v.currentJobTitle} onChange={(e) => set('currentJobTitle', e.target.value)} error={errors.currentJobTitle} />}
          <TextField label="Target role" optional maxLength={100} value={v.targetRole} onChange={(e) => set('targetRole', e.target.value)} error={errors.targetRole} />
          <TextField label="Industry" optional maxLength={100} value={v.industry} onChange={(e) => set('industry', e.target.value)} error={errors.industry} />
          {working && <TextField label="Total experience (months)" optional type="number" inputMode="numeric" min={0} max={600} value={v.experienceMonths} onChange={(e) => set('experienceMonths', e.target.value)} error={errors.experienceMonths} />}
          {employed && <TextField label="Time in current job (months)" optional type="number" inputMode="numeric" min={0} max={600} value={v.tenureMonths} onChange={(e) => set('tenureMonths', e.target.value)} error={errors.tenureMonths} />}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Skills you have" optional hint="Separate with commas" value={v.skills} onChange={(e) => set('skills', e.target.value)} error={errors.skills} />
          <TextField label="Skills you want to develop" optional hint="Separate with commas" value={v.growthSkills} onChange={(e) => set('growthSkills', e.target.value)} error={errors.growthSkills} />
        </div>

        <TextAreaField label="Career goals" optional rows={3} maxLength={600} counter={`${v.goals.length}/600`} hint="Please do not include names, emails or phone numbers." value={v.goals} onChange={(e) => set('goals', e.target.value)} error={errors.goals} />

        <CheckboxGroup legend="What matters most to you" options={PRIORITY_OPTIONS} selected={v.priorities} onChange={(next) => set('priorities', next)} />

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Expected salary, min (LPA)" optional type="number" inputMode="decimal" min={0} step="0.5" value={v.salaryMinLpa} onChange={(e) => set('salaryMinLpa', e.target.value)} error={errors.salaryMinLpa} />
          <TextField label="Expected salary, max (LPA)" optional type="number" inputMode="decimal" min={0} step="0.5" value={v.salaryMaxLpa} onChange={(e) => set('salaryMaxLpa', e.target.value)} error={errors.salaryMaxLpa} />
          <TextField label="Preferred locations" optional hint="Separate with commas" value={v.preferredLocations} onChange={(e) => set('preferredLocations', e.target.value)} error={errors.preferredLocations} />
        </div>

        <CheckboxGroup legend={employed ? 'Current concerns about your job' : 'Concerns that are on your mind'} options={FACTOR_OPTIONS} selected={v.concerns} onChange={(next) => set('concerns', next)} />

        <fieldset className="space-y-4 rounded-xl border border-line bg-canvas p-4">
          <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-ink">
            <Lock className="h-3.5 w-3.5" aria-hidden /> More sensitive details (optional)
          </legend>
          <p className="text-xs leading-relaxed text-muted">
            These are visible only to you, are used only to make suggestions fit your situation, and are never shown to other users. Skip anything you prefer not to share. The AI option never receives them. You can delete all of your career data at any time.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Savings runway (months of expenses)" optional type="number" inputMode="decimal" min={0} max={120} step="0.5" value={v.financialRunwayMonths} onChange={(e) => set('financialRunwayMonths', e.target.value)} error={errors.financialRunwayMonths} />
            {employed && <TextField label="Notice period (days)" optional type="number" inputMode="numeric" min={0} max={365} value={v.noticePeriodDays} onChange={(e) => set('noticePeriodDays', e.target.value)} error={errors.noticePeriodDays} />}
          </div>
          {employed && <CheckboxGroup legend="Reasons you might leave" hint="Only if you are thinking about it." options={FACTOR_OPTIONS} selected={v.exitReasons} onChange={(next) => set('exitReasons', next)} />}
        </fieldset>

        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <Button type="submit" loading={saving}>
          {saving ? 'Saving…' : profile ? 'Save changes' : 'Save profile'}
        </Button>
      </form>
    </Card>
  );
}
