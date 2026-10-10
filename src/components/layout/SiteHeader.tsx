'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { LogoLink } from '@/components/brand/Logo';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { useSession } from '@/components/auth/AuthProvider';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/companies', label: 'Companies' },
  { href: '/reports', label: 'Submit Report' },
  { href: '/tracker', label: 'Track Offer' },
  { href: '/backup-planner', label: 'Backup Planner' },
  { href: '/methodology', label: 'Methodology' },
] as const;

function isActive(pathname: string | null, href: string) {
  return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

function AuthArea({ onNavigate }: { onNavigate?: () => void }) {
  const { status, user } = useSession();
  if (status === 'loading') return <Skeleton className="h-9 w-24 rounded-full" />;
  // No accounts configured on this server: do not advertise log in / sign up.
  if (status === 'unconfigured') return null;
  if (user) return <AccountMenu user={user} />;
  return (
    <div className="flex items-center gap-2">
      <ButtonLink href="/login" variant="ghost" size="sm" onClick={onNavigate}>
        Log in
      </ButtonLink>
      <ButtonLink href="/signup" size="sm" onClick={onNavigate}>
        Sign up
      </ButtonLink>
    </div>
  );
}

function HeaderBar({ pathname }: { pathname: string | null }) {
  const [open, setOpen] = useState(false);

  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <LogoLink size="md" priority />

        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-brand-50/70 hover:text-ink'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <div className="hidden lg:block">
            <AuthArea />
          </div>
          <div className="lg:hidden">
            <AuthAreaCompact />
          </div>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft hover:bg-brand-50 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Primary" className="border-t border-line bg-surface lg:hidden">
          <ul className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium',
                      active ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-brand-50/70'
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="border-t border-line pt-2">
              <MenuAccountLinks onNavigate={() => setOpen(false)} />
              <Link href="/mobile" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-brand-700 hover:bg-brand-50">
                Open the mobile app view
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

/** Account entries inside the collapsed menu: sign up for visitors, profile for signed-in users. */
function MenuAccountLinks({ onNavigate }: { onNavigate: () => void }) {
  const { status, user } = useSession();
  const item = 'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-brand-50/70';
  if (status === 'authenticated' && user) {
    return (
      <Link href="/profile" onClick={onNavigate} className={item}>
        Profile
      </Link>
    );
  }
  if (status !== 'anonymous') return null;
  return (
    <>
      <Link href="/login" onClick={onNavigate} className={item}>
        Log in
      </Link>
      <Link href="/signup" onClick={onNavigate} className={item}>
        Sign up
      </Link>
    </>
  );
}

/** Below the lg breakpoint only the signed-in avatar is shown in the bar; log in / sign up live in the menu. */
function AuthAreaCompact() {
  const { status, user } = useSession();
  if (status === 'loading') return <Skeleton className="h-9 w-9 rounded-full" />;
  if (user) return <AccountMenu user={user} />;
  if (status === 'unconfigured') return null;
  return (
    <ButtonLink href="/login" variant="secondary" size="sm">
      Log in
    </ButtonLink>
  );
}

function HeaderWithPath() {
  return <HeaderBar pathname={usePathname()} />;
}

export function SiteHeader() {
  // usePathname() can suspend on routes with dynamic segments; the fallback is the same bar without an active state.
  return (
    <Suspense fallback={<HeaderBar pathname={null} />}>
      <HeaderWithPath />
    </Suspense>
  );
}
