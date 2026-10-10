'use client';

// Modal dialog on the native <dialog> element: the browser traps focus, restores it on close and handles Esc.
// Centered on larger screens; a bottom sheet on phones (with safe-area padding).
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Keep the page behind the dialog from scrolling.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      // A click on the backdrop reports the <dialog> itself as the target.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        'fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop',
        'max-sm:inset-auto max-sm:bottom-0 max-sm:left-0 max-sm:m-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none',
        className
      )}
    >
      {open && (
        <div className="pb-safe">
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-brand-50 hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="px-4 py-4 sm:px-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
