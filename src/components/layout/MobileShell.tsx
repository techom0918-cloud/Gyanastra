'use client';

// App-style shell for /mobile: slim top bar + bottom tab bar (respects notch / home-indicator safe areas).
import { Building2, ClipboardList, FilePlus2, Home, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { useSession } from '@/components/auth/AuthProvider';
import { LogoLink } from '@/components/brand/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/States';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/mobile', label: 'Home', icon: Home, exact: true },
  { href: '/mobile/companies', label: 'Companies', icon: Building2, exact: false },
  { href: '/mobile/report', label: 'Report', icon: FilePlus2, exact: false },
  { href: '/mobile/offers', label: 'Offers', icon: ClipboardList, exact: false },
  { href: '/mobile/profile', label: 'Profile', icon: UserRound, exact: false },
];

function TopBarAccount() {
  const { status, user } = useSession();
  if (status === 'loading') return <Skeleton className="h-9 w-9 rounded-full" />;
  if (user) return <AccountMenu user={user} base="/mobile" />;
  if (status === 'unconfigured') return null;
  return (
    <ButtonLink href="/login?next=%2Fmobile" size="sm" variant="secondary">
      Log in
    </ButtonLink>
  );
}

function TabBar() {
  const pathname = usePathname();
  return (
      <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || Boolean(pathname?.startsWith(`${href}/`));
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-brand-700' : 'text-muted hover:text-ink')}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <LogoLink href="/mobile" size="sm" />
          <TopBarAccount />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-5">
        {children}
      </main>
      <Suspense fallback={null}>
        <TabBar />
      </Suspense>
    </>
  );
}
