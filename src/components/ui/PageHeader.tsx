import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Standard page container + title block. */
export function Page({ children, width = 'lg', className }: { children: ReactNode; width?: 'md' | 'lg' | 'xl'; className?: string }) {
  const widths = { md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' } as const;
  return <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 sm:py-10', widths[width], className)}>{children}</div>;
}

export function PageHeader({ title, description, actions, className }: { title: string; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn('mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
