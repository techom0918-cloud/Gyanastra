'use client';

// Small pieces shared by the Career Intelligence panels.
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Pill } from '@/components/ui/StatusBadge';
import { SelectField } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import type { EvidenceItem, EvidenceType, YesNoUnknown } from '@/lib/career/types';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string; fieldErrors: Record<string, string> };

/** JSON request to a career endpoint. Never throws: network and server failures become a readable message. */
export async function careerFetch<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T };
    const fieldErrors: Record<string, string> = {};
    if (data.details && typeof data.details === 'object') {
      for (const [k, v] of Object.entries(data.details)) if (Array.isArray(v) && typeof v[0] === 'string') fieldErrors[k] = v[0];
    }
    const message =
      res.status === 401 ? 'Your session has ended. Please sign in again.' : res.status === 429 ? 'Too many requests. Please wait a few minutes and try again.' : typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.';
    return { ok: false, status: res.status, message, fieldErrors };
  } catch {
    return { ok: false, status: 0, message: 'We could not reach the server. Check your connection and try again.', fieldErrors: {} };
  }
}

export const toNumber = (s: string): number | undefined => {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};
export const toList = (s: string): string[] => s.split(',').map((x) => x.trim()).filter(Boolean);
export const fromList = (items: string[] | undefined) => (items ?? []).join(', ');

const EVIDENCE_LABEL: Record<EvidenceType, string> = { reported_fact: 'Community report', user_statement: 'You told us', inference: 'Our inference' };

/** Facts, the user's own statements and inferences are always visibly different. */
export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex flex-col gap-1 rounded-lg bg-canvas px-3 py-2.5 text-sm sm:flex-row sm:items-start sm:gap-3">
          <Pill tone={item.type === 'inference' ? 'demo' : item.type === 'reported_fact' ? 'brand' : 'neutral'} className="shrink-0 self-start">
            {EVIDENCE_LABEL[item.type]}
          </Pill>
          <span className="leading-relaxed text-ink">
            {item.text}
            {item.concern && <span className="ml-1.5 font-medium text-amber-800">(raises a concern)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

export function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink marker:text-muted">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-line bg-canvas p-3 text-xs leading-relaxed text-muted">{children}</p>;
}

export function YesNoField({ label, value, onChange, hint }: { label: string; value: YesNoUnknown; onChange: (v: YesNoUnknown) => void; hint?: string }) {
  return (
    <SelectField label={label} hint={hint} value={value} onChange={(e) => onChange(e.target.value as YesNoUnknown)}>
      <option value="unknown">Not sure</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </SelectField>
  );
}

/** Multi-select as a group of checkboxes (keyboard and screen-reader friendly). */
export function CheckboxGroup<K extends string>({ legend, hint, options, selected, onChange }: { legend: string; hint?: string; options: readonly { value: K; label: string }[]; selected: K[]; onChange: (next: K[]) => void }) {
  const hintId = useId();
  return (
    <fieldset aria-describedby={hint ? hintId : undefined}>
      <legend className="mb-1.5 text-sm font-medium text-ink">
        {legend} <span className="font-normal text-muted">(optional)</span>
      </legend>
      {hint && (
        <p id={hintId} className="mb-2 text-xs text-muted">
          {hint}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={o.value} className={cn('inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-brand-200', checked ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line-strong bg-surface text-ink-soft hover:border-brand-300')}>
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand-600)]" checked={checked} onChange={() => onChange(checked ? selected.filter((s) => s !== o.value) : [...selected, o.value])} />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
