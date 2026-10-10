import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const TONES = {
  info: { box: 'border-brand-200 bg-brand-50 text-brand-800', icon: Info },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CircleCheck },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: TriangleAlert },
  error: { box: 'border-red-200 bg-red-50 text-red-900', icon: CircleAlert },
} as const;

export type AlertTone = keyof typeof TONES;

/** Errors are announced immediately (role="alert"); other tones politely (role="status"). */
export function Alert({ tone = 'info', title, children, className }: { tone?: AlertTone; title?: string; children?: ReactNode; className?: string }) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', box, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
