// Storage backend contract. store.ts holds the domain logic (company summaries,
// stats, alerts) and delegates raw reads/writes to one of these implementations.
import { OfferReport, TrackedOffer } from '@/types';

export type StorageMode = 'supabase' | 'memory';

/** A report ready to insert; the backend assigns the id. */
export type NewOfferReport = Omit<OfferReport, 'id'>;

/** A tracked offer ready to insert; the backend assigns the id. Alerts are never stored. */
export type NewTrackedOffer = Omit<TrackedOffer, 'id' | 'alerts'>;

/** Fields of a tracked offer that may be changed after creation. */
export type TrackedOfferChanges = Partial<Omit<TrackedOffer, 'id' | 'alerts' | 'isDemo'>>;

export interface Repository {
  readonly mode: StorageMode;
  listReports(): Promise<OfferReport[]>;
  listReportsByCompany(slug: string): Promise<OfferReport[]>;
  insertReport(report: NewOfferReport): Promise<OfferReport>;
  listTrackedOffers(): Promise<TrackedOffer[]>;
  insertTrackedOffer(offer: NewTrackedOffer): Promise<TrackedOffer>;
  /** Returns null when no offer has this id. */
  updateTrackedOffer(id: string, changes: TrackedOfferChanges): Promise<TrackedOffer | null>;
}

export class StoreError extends Error {
  constructor(
    readonly kind: 'not_configured' | 'query_failed',
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'StoreError';
  }
}
