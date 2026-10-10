// Shared response helpers for API routes that use the store.
import 'server-only';
import { NextResponse } from 'next/server';
import { StoreError } from './repository';
import { getStorageMode } from './store';

export const STORAGE_HEADER = 'x-aagey-storage';

/** JSON response tagged with the active storage backend ("supabase" or "memory"). */
export function jsonWithStorage(body: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(body, init);
  try {
    res.headers.set(STORAGE_HEADER, getStorageMode());
  } catch {
    // Misconfigured storage: the handler already reported it via storeErrorResponse.
  }
  return res;
}

/** Maps storage failures to a generic error body; details go to the server log only. */
export function storeErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  console.error('[aagey] storage error:', error);
  if (error instanceof StoreError && error.kind === 'not_configured') {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
