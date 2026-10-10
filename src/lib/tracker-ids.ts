// Tracked offers have no accounts: the random offer id is the private access key, kept only in the browser
// that created it. Shared by the tracker API (server) and the tracker page (browser).
export const OFFER_IDS_HEADER = 'x-aagey-offer-ids';
export const MAX_VIEWER_IDS = 20;
export const OFFER_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

const STORAGE_KEY = 'aagey.trackedOfferIds';

/** Ids of offers created in this browser. Storage may be unavailable (private mode): then nothing is remembered. */
export function loadOwnOfferIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && OFFER_ID_PATTERN.test(id)) : [];
  } catch {
    return [];
  }
}

export function rememberOwnOfferId(id: string): void {
  try {
    const ids = [id, ...loadOwnOfferIds().filter((existing) => existing !== id)].slice(0, MAX_VIEWER_IDS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable: the offer is saved but this browser cannot list it later.
  }
}
