'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { Pill } from '@/components/ui/StatusBadge';
import type { ActionPlanResult, CareerProfile, PlanTask, StoredAssessment } from '@/lib/career/types';
import { careerFetch, Disclaimer } from './shared';

const BASIS: Record<PlanTask['basis'], string> = { profile: 'From your profile', assessment: 'From your assessments', general: 'General practice', ai_suggestion: 'AI suggestion' };
const FALLBACK_TEXT: Record<string, string> = {
  not_configured: 'AI personalisation is not available on this server, so the rule-based plan was used.',
  rate_limited: 'You have reached the AI limit for now, so the rule-based plan was used.',
  ai_unavailable: 'The AI service did not respond usefully, so the rule-based plan was used.',
};

export function ActionPlanPanel({ profile, latest, aiAvailable, onPlan, onProgress }: { profile: CareerProfile | null; latest: StoredAssessment<ActionPlanResult> | null; aiAvailable: boolean; onPlan: (a: StoredAssessment<ActionPlanResult>) => void; onProgress: (taskId: string, done: boolean) => void }) {
  const [useAi, setUseAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const res = await careerFetch<{ assessment: StoredAssessment<ActionPlanResult>; source: 'ai' | 'rules'; fallbackReason?: string }>('/api/career/assess', 'POST', { kind: 'action_plan', input: { useAi } });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    if (res.data.fallbackReason && FALLBACK_TEXT[res.data.fallbackReason]) setNotice(FALLBACK_TEXT[res.data.fallbackReason]);
    onPlan(res.data.assessment);
  }

  async function toggle(taskId: string, done: boolean) {
    if (!latest) return;
    onProgress(taskId, done); // optimistic
    const res = await careerFetch('/api/career/progress', 'PUT', { assessmentId: latest.id, taskId, done });
    if (!res.ok) {
      onProgress(taskId, !done); // roll back
      setError(res.message);
    }
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader title="30-60-90 day action plan" />
        <EmptyState icon={Sparkles} title="Save your profile first" description="The plan is built from your profile and any assessments you have run. Start with the Profile tab." />
      </Card>
    );
  }

  const done = new Set(latest?.completedTaskIds ?? []);
  const all = latest?.result.phases.flatMap((p) => p.tasks) ?? [];
  const completed = all.filter((t) => done.has(t.id)).length;

  return (
    <Card>
      <CardHeader title="30-60-90 day action plan" description="Suggested goals based on what you told us. Regenerate whenever your situation changes." />
      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            {aiAvailable && (
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand-600)]" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
                <span>
                  Personalise the wording with AI
                  <span className="block text-xs text-muted">Sends only your role, industry, skills, goals and priorities. Never salary, savings, notice period, reasons for leaving, company or dates.</span>
                </span>
              </label>
            )}
          </div>
          <Button onClick={generate} loading={busy} variant={latest ? 'secondary' : 'primary'}>
            {busy ? 'Building…' : latest ? 'Regenerate plan' : 'Build my plan'}
          </Button>
        </div>
        {latest && <p className="text-xs text-muted">Regenerating creates a fresh plan, so task ticks start again. Your previous plan is replaced in this view.</p>}

        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}

        {latest && (
          <div className="space-y-5">
            <div>
              <p className="text-base font-semibold text-ink">{latest.result.summary}</p>
              <p className="mt-1 text-sm text-muted" aria-live="polite">
                {completed} of {all.length} tasks done · {latest.source === 'ai' ? 'AI-personalised' : 'Rule-based'} · created {new Date(latest.createdAt).toLocaleDateString()}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Plan progress" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={completed}>
                <div className="h-full bg-brand-500 transition-all" style={{ width: all.length ? `${(completed / all.length) * 100}%` : '0%' }} />
              </div>
            </div>

            {latest.result.phases.map((phase) => (
              <section key={phase.days} aria-labelledby={`phase-${phase.days}`}>
                <h3 id={`phase-${phase.days}`} className="text-sm font-semibold text-ink">
                  {phase.days} days <span className="font-normal text-muted">· {phase.goal}</span>
                </h3>
                <ul className="mt-2 space-y-2">
                  {phase.tasks.map((t) => (
                    <li key={t.id} className="rounded-xl border border-line p-3.5">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand-600)]" checked={done.has(t.id)} onChange={(e) => void toggle(t.id, e.target.checked)} />
                        <span className="min-w-0">
                          <span className={done.has(t.id) ? 'text-sm text-muted line-through' : 'text-sm font-medium text-ink'}>{t.title}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-muted">Why: {t.why}</span>
                          <Pill tone={t.basis === 'ai_suggestion' ? 'demo' : 'neutral'} className="mt-2">
                            {BASIS[t.basis]}
                          </Pill>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <Disclaimer>{latest.result.disclaimer}</Disclaimer>
          </div>
        )}
      </div>
    </Card>
  );
}
