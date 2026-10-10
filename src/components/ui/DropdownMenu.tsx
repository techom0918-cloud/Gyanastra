'use client';

// Accessible dropdown menu: aria-haspopup/expanded trigger, role="menu" items, arrow-key navigation,
// Esc closes and returns focus to the trigger, Tab or an outside click closes.
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type MenuItem =
  | { kind: 'link'; href: string; label: string; icon?: LucideIcon }
  | { kind: 'button'; label: string; onSelect: () => void; icon?: LucideIcon; tone?: 'danger' }
  | { kind: 'header'; title: string; subtitle?: string }
  | { kind: 'separator' };

export function DropdownMenu({
  label,
  trigger,
  items,
  align = 'right',
  triggerClassName,
}: {
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const menuItems = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    menuItems()[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const els = menuItems();
    const index = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(index + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(index - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      els[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      els[els.length - 1]?.focus();
    }
  };

  const itemClass = (tone?: 'danger') =>
    cn(
      'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm focus:outline-none sm:min-h-10',
      tone === 'danger' ? 'text-red-700 hover:bg-red-50 focus:bg-red-50' : 'text-ink hover:bg-brand-50 focus:bg-brand-50'
    );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn('flex h-11 min-w-11 items-center justify-center rounded-full', triggerClassName)}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-1.5 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, i) => {
            if (item.kind === 'separator') return <div key={i} role="separator" className="my-1 h-px bg-line" />;
            if (item.kind === 'header') {
              return (
                <div key={i} role="presentation" className="px-3 py-2">
                  <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                  {item.subtitle && <p className="truncate text-xs text-muted">{item.subtitle}</p>}
                </div>
              );
            }
            const Icon = item.icon;
            if (item.kind === 'link') {
              return (
                <Link key={i} href={item.href} role="menuitem" onClick={() => close(false)} className={itemClass()}>
                  {Icon && <Icon className="h-4 w-4 text-muted" aria-hidden />}
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  close(false);
                  item.onSelect();
                }}
                className={itemClass(item.tone)}
              >
                {Icon && <Icon className="h-4 w-4" aria-hidden />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
