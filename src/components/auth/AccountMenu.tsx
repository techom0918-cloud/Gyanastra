'use client';

import { Compass, LayoutDashboard, LogOut, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { logoutAction } from '@/lib/auth/actions';
import type { AuthUser } from '@/lib/auth/types';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { useSession } from './AuthProvider';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-600 font-semibold text-white ${size === 'lg' ? 'h-16 w-16 text-xl' : 'h-9 w-9 text-xs'}`}
    >
      {initials(name)}
    </span>
  );
}

/** Logs out on the server (clearing the session cookies), refreshes the browser's view, then goes home. */
export function useLogout() {
  const { refresh } = useSession();
  const router = useRouter();
  return async () => {
    await logoutAction();
    await refresh();
    router.replace('/');
  };
}

/** Avatar button with account details, links and logout. `base` is "" for the site and "/mobile" for the app. */
export function AccountMenu({ user, base = '' }: { user: AuthUser; base?: string }) {
  const logout = useLogout();
  return (
    <DropdownMenu
      label="Account menu"
      trigger={<Avatar name={user.name} />}
      items={[
        { kind: 'header', title: user.name, subtitle: user.email },
        { kind: 'separator' },
        { kind: 'link', href: base ? `${base}` : '/dashboard', label: base ? 'Home' : 'Dashboard', icon: LayoutDashboard },
        { kind: 'link', href: '/career-intelligence', label: 'Career Intelligence', icon: Compass },
        { kind: 'link', href: base ? `${base}/profile` : '/profile', label: 'Profile', icon: UserRound },
        { kind: 'separator' },
        { kind: 'button', label: 'Log out', icon: LogOut, tone: 'danger', onSelect: () => void logout() },
      ]}
    />
  );
}
