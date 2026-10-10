import type { ReactNode } from 'react';
import { LogoLink, TAGLINE } from '@/components/brand/Logo';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/States';

/** Shared frame for the account screens: the logo is the primary brand element, then one focused card. */
export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <LogoLink size="xl" priority />
        {/* The tagline is inside the logo image but too small to read at this size, so it is repeated as text. */}
        <p className="mt-3 text-sm font-medium text-ink-soft">{TAGLINE}</p>
      </div>
      <Card className="p-5 sm:p-7">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </Card>
      {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}

/** Suspense fallback with the same footprint as AuthCard, so nothing jumps when the form arrives. */
export function AuthCardSkeleton() {
  return (
    <div className="w-full max-w-md" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="mb-6 flex flex-col items-center gap-3">
        <Skeleton className="h-16 w-52 sm:h-20 sm:w-64" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-4 rounded-xl border border-line bg-surface p-7 shadow-card">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
