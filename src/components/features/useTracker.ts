'use client';

// Tracked offers for the current visitor, through the ownership-aware /api/tracker.
//  - signed in: the account's own offers (server-validated session, stored in the database)
//  - signed out: the original browser-held model (private ids kept in this browser + the demo offer)
import { useCallback, useEffect, useState } from 'react';
import { loadOwnOfferIds, OFFER_IDS_HEADER, rememberOwnOfferId } from '@/lib/tracker-ids';
import { OfferStatus, TrackedOffer } from '@/types';
import { useSession } from '@/components/auth/AuthProvider';

export interface NewOfferInput {
  companyName: string;
  role?: string;
  offerDate?: string;
  expectedJoiningDate?: string;
  currentStatus: OfferStatus;
  notes?: string;
}

export type MutationResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

interface TrackerState {
  offers: TrackedOffer[];
  loading: boolean;
  error: boolean;
  scope: 'account' | 'browser' | null;
  /** False when the visitor is signed in but the accounts migration has not been applied. */
  accountTracking: boolean;
}

/** `enabled: false` skips the request entirely (e.g. for visitors whose offers are not shown). */
export function useTracker(enabled = true) {
  const { status } = useSession();
  const [state, setState] = useState<TrackerState>({ offers: [], loading: true, error: false, scope: null, accountTracking: true });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const res = await fetch('/api/tracker', {
        cache: 'no-store',
        headers: { [OFFER_IDS_HEADER]: loadOwnOfferIds().join(',') },
      });
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as { offers?: TrackedOffer[]; scope?: 'account' | 'browser'; accountTracking?: boolean };
      setState({ offers: data.offers ?? [], loading: false, error: false, scope: data.scope ?? 'browser', accountTracking: data.accountTracking !== false });
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, []);

  // Wait until the session is known, so the first request is already the right kind (no signed-out flash).
  useEffect(() => {
    if (!enabled || status === 'loading') return;
    // Deferred so state is not set synchronously inside the effect body.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [enabled, status, load]);

  const addOffer = useCallback(
    async (input: NewOfferInput): Promise<MutationResult> => {
      try {
        const res = await fetch('/api/tracker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const fieldErrors: Record<string, string> = {};
          if (data.details && typeof data.details === 'object') {
            for (const [k, v] of Object.entries(data.details)) if (Array.isArray(v) && typeof v[0] === 'string') fieldErrors[k] = v[0];
          }
          return { ok: false, message: data.error ?? 'Could not save this offer.', fieldErrors };
        }
        if (data.offer?.id && status !== 'authenticated') rememberOwnOfferId(data.offer.id);
        await load();
        return { ok: true };
      } catch {
        return { ok: false, message: 'We could not reach the server. Check your connection and try again.' };
      }
    },
    [load, status]
  );

  const updateStatus = useCallback(
    async (id: string, currentStatus: OfferStatus): Promise<MutationResult> => {
      try {
        const res = await fetch('/api/tracker', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, currentStatus }) });
        if (!res.ok) return { ok: false, message: res.status === 404 ? 'This offer can no longer be changed.' : 'Could not update the status.' };
        await load();
        return { ok: true };
      } catch {
        return { ok: false, message: 'We could not reach the server. Try again in a moment.' };
      }
    },
    [load]
  );

  return { ...state, reload: load, addOffer, updateStatus };
}
