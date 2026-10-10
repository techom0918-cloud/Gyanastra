'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { Pill } from '@/components/ui/StatusBadge';
import { OFFER_STATUS_LABELS, type OfferStatus } from '@/types';
import type { OfferConcernLevel, OfferRiskResult, StoredAssessment, YesNoUnknown } from '@/lib/career/types';
import { BulletList, careerFetch, Disclaimer, EvidenceList, Section, YesNoField } from './shared';

const LEVEL: Record<OfferConcernLevel, { label: string; tone: 'neutral' | 'demo' | 'brand' }> = {
  insufficient_information: { label: 'Not enough information', tone: 'neutral' },
  no_specific_concerns: { label: 'No specific concerns found', tone: 'brand' },
  some_open_questions: { label: 'Some open questions', tone: 'demo' },
  needs_attention: { label: 'Needs attention', tone: 'demo' },
};

export function OfferRiskResultView({ result }: { result: OfferRiskResult }) {
  const level = LEVEL[result.level];
  return (
    <div className="space-y-5">
      <div>
        <Pill tone={level.tone}>{level.label}</Pill>
        <p className="mt-2 text-base font-semibold leading-snug text-ink">{result.headline}</p>
      </div>
      <Section title="What this is based on">
        <EvidenceList items={result.evidence} />
      </Section>
      {result.company && (
        <Section title="Company context (other people's reports)">
          <p className="rounded-lg bg-canvas p-3 text-sm leading-relaxed text-ink">{result.company.summary}</p>
        </Section>
      )}
      {result.unknowns.length > 0 && (
        <Section title="What we do not know">
          <BulletList items={result.unknowns} />
        </Section>
      )}
      <Section title="What to verify">
        <BulletList items={result.verify} />
      </Section>
      <Section title="Practical next steps">
        <BulletList items={result.actions} />
      </Section>
      <Disclaimer>{result.disclaimer}</Disclaimer>
    </div>
  );
}

export function OfferRiskPanel({ latest, onAssessed }: { latest: StoredAssessment<OfferRiskResult> | null; onAssessed: (a: StoredAssessment<OfferRiskResult>) => void }) {
  const [editing, setEditing] = useState(!latest);
  const [companyName, setCompanyName] = useState('');
  const [offerStage, setOfferStage] = useState<OfferStatus>('offer_received');
  const [offerDate, setOfferDate] = useState('');
  const [expectedJoiningDate, setJoining] = useState('');
  const [lastCommunicationDate, setLastContact] = useState('');
  const [hasWrittenOffer, setWritten] = useState<YesNoUnknown>('unknown');
  const [joiningDateConfirmed, setConfirmed] = useState<YesNoUnknown>('unknown');
  const [recruiterResponsive, setResponsive] = useState<YesNoUnknown>('unknown');
  const [hasBackup, setBackup] = useState<YesNoUnknown>('unknown');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await careerFetch<{ assessment: StoredAssessment<OfferRiskResult> }>('/api/career/assess', 'POST', {
      kind: 'offer_risk',
      input: {
        companyName,
        offerStage,
        offerDate: offerDate || undefined,
        expectedJoiningDate: expectedJoiningDate || undefined,
        lastCommunicationDate: lastCommunicationDate || undefined,
        hasWrittenOffer,
        joiningDateConfirmed,
        recruiterResponsive,
        hasBackup,
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
        title="Offer check"
        description="A checklist-style look at your own offer. It is not a prediction, and it is separate from your job stability."
        action={latest && !editing ? <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Update my situation</Button> : undefined}
      />
      <div className="p-4 sm:p-5">
        {editing ? (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Company" optional maxLength={200} hint="Used only to look up community reports, if any exist." value={companyName} onChange={(e) => setCompanyName(e.target.value)} error={errors.companyName} />
              <SelectField label="Where does your offer stand?" required value={offerStage} onChange={(e) => setOfferStage(e.target.value as OfferStatus)} error={errors.offerStage}>
                {(Object.keys(OFFER_STATUS_LABELS) as OfferStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {OFFER_STATUS_LABELS[s]}
                  </option>
                ))}
              </SelectField>
              <TextField label="Offer date" optional type="date" value={offerDate} onChange={(e) => setOfferDate(e.target.value)} error={errors.offerDate} />
              <TextField label="Expected joining date" optional type="date" value={expectedJoiningDate} onChange={(e) => setJoining(e.target.value)} error={errors.expectedJoiningDate} />
              <TextField label="Last time you heard from them" optional type="date" value={lastCommunicationDate} onChange={(e) => setLastContact(e.target.value)} error={errors.lastCommunicationDate} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <YesNoField label="Do you have a written offer letter?" value={hasWrittenOffer} onChange={setWritten} />
              <YesNoField label="Is the joining date confirmed in writing?" value={joiningDateConfirmed} onChange={setConfirmed} />
              <YesNoField label="Has the recruiter or HR been responsive?" value={recruiterResponsive} onChange={setResponsive} />
              <YesNoField label="Are backup applications in progress?" value={hasBackup} onChange={setBackup} />
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={busy}>
                {busy ? 'Checking…' : 'Check my offer'}
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
            <p className="text-xs text-muted">Last checked {new Date(latest.createdAt).toLocaleDateString()}</p>
            <OfferRiskResultView result={latest.result} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
