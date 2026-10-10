// Storage backend contract. store.ts holds the domain logic (company summaries,
// stats, alerts) and delegates raw reads/writes to one of these implementations.
import { OfferReport, TrackedOffer } from '@/types';
import type { RecentSubmission } from '../abuse/submissions';

export type StorageMode = 'supabase' | 'memory';

/** A report ready to insert; the backend assigns the id. */
export type NewOfferReport = Omit<OfferReport, 'id'>;

/** A tracked offer ready to insert; the backend assigns the id. Alerts are never stored. */
export type NewTrackedOffer = Omit<TrackedOffer, 'id' | 'alerts'>;

/** Fields of a tracked offer that may be changed after creation. */
export type TrackedOfferChanges = Partial<Omit<TrackedOffer, 'id' | 'alerts' | 'isDemo'>>;

/** Abuse-control metadata stored with a report; never returned by the API. */
export interface ReportSubmissionMeta {
  /** Daily-rotating keyed hash of the submitter's network address (see lib/abuse/submissions.ts). */
  submitterHash?: string;
}

export interface Repository {
  readonly mode: StorageMode;
  listReports(): Promise<OfferReport[]>;
  listReportsByCompany(slug: string): Promise<OfferReport[]>;
  insertReport(report: NewOfferReport, meta?: ReportSubmissionMeta): Promise<OfferReport>;
  /**
   * Reports stored with this submitter hash since `sinceIso`, or null when the backend cannot record
   * submitter hashes (e.g. the migration adding offer_reports.submitter_hash has not been applied).
   */
  listSubmissionsBySubmitter(submitterHash: string, sinceIso: string): Promise<RecentSubmission[] | null>;
  /** Every tracked offer. Internal use only: the API never lists other people's offers. */
  listTrackedOffers(): Promise<TrackedOffer[]>;
  /**
   * Browser-held tracking (no account): demo offers plus the non-demo, account-less offers whose ids the viewer
   * holds (the id is the private access key). Offers owned by an account are never returned here.
   */
  listTrackedOffersForViewer(ids: string[]): Promise<TrackedOffer[]>;
  /** Offers owned by this account (never demo offers). */
  listTrackedOffersForUser(userId: string): Promise<TrackedOffer[]>;
  /** False until the migration adding tracked_offers.user_id (20261010000004) has been applied. */
  supportsUserOffers(): Promise<boolean>;
  /** Creates an offer; with ownerUserId it belongs to that account, otherwise it is browser-held. */
  insertTrackedOffer(offer: NewTrackedOffer, ownerUserId?: string): Promise<TrackedOffer>;
  /**
   * Updates a non-demo offer the caller may change: one owned by ownerUserId, or, without an owner, an account-less
   * (browser-held) offer. Returns null when no such offer exists, so account-owned offers cannot be probed or edited
   * through the anonymous path, and demo offers are read-only.
   */
  updateTrackedOffer(id: string, changes: TrackedOfferChanges, ownerUserId?: string): Promise<TrackedOffer | null>;
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
