'use client';

// Browser-side view of the session. The server is the source of truth: this only mirrors /api/auth/session so the UI
// can show who is signed in. Components must treat status "loading" as "unknown" and render a neutral skeleton (never
// signed-in content, and never a sign-in prompt) until the server has answered.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser, SessionPayload } from '@/lib/auth/types';

export type SessionStatus = 'loading' | 'anonymous' | 'authenticated' | 'unconfigured';

export interface SessionValue {
  status: SessionStatus;
  user: AuthUser | null;
  /** Re-reads the session from the server (call after logging in or out). */
  refresh: () => Promise<void>;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <AuthProvider>');
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: SessionStatus; user: AuthUser | null }>({ status: 'loading', user: null });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error(`session ${res.status}`);
      const data = (await res.json()) as SessionPayload;
      setState(
        !data.configured
          ? { status: 'unconfigured', user: null }
          : data.user
            ? { status: 'authenticated', user: data.user }
            : { status: 'anonymous', user: null }
      );
    } catch {
      // Offline or server error: keep whatever we knew; if we never knew anything, behave as signed out.
      setState((prev) => (prev.status === 'loading' ? { status: 'anonymous', user: null } : prev));
    }
  }, []);

  useEffect(() => {
    // Initial read is deferred out of the effect body so state is never set synchronously inside it.
    const initial = setTimeout(() => void refresh(), 0);
    // Pick up logouts or expiry that happened in another tab.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(initial);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const value = useMemo<SessionValue>(() => ({ ...state, refresh }), [state, refresh]);
  return <SessionContext value={value}>{children}</SessionContext>;
}
