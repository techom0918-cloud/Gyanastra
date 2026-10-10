// In-memory backend: used when Supabase is not configured. Data is lost on restart.
import { OfferReport, TrackedOffer } from '@/types';
import { SEED_REPORTS, SEED_TRACKED_OFFERS } from './seed';
import { NewOfferReport, NewTrackedOffer, ReportSubmissionMeta, Repository, TrackedOfferChanges } from './repository';
import type { RecentSubmission } from '../abuse/submissions';

// Tracked-offer ids double as private access keys, so they must be unguessable.
function newId(): string {
  return crypto.randomUUID();
}

export function createMemoryRepository(
  seedReports: OfferReport[] = SEED_REPORTS,
  seedTrackedOffers: TrackedOffer[] = SEED_TRACKED_OFFERS
): Repository {
  const reports: OfferReport[] = seedReports.map((r) => ({ ...r }));
  const trackedOffers: TrackedOffer[] = seedTrackedOffers.map((o) => ({ ...o, alerts: [] }));
  const submissions: { hash: string; entry: RecentSubmission }[] = [];
  // Which account owns which tracked offer (the public TrackedOffer shape has no owner field).
  const owners = new Map<string, string>();

  return {
    mode: 'memory',

    async listReports() {
      return reports.map((r) => ({ ...r }));
    },

    async listReportsByCompany(slug: string) {
      return reports.filter((r) => r.companySlug === slug).map((r) => ({ ...r }));
    },

    async insertReport(report: NewOfferReport, meta?: ReportSubmissionMeta) {
      const created: OfferReport = { ...report, id: newId() };
      reports.push(created);
      if (meta?.submitterHash) {
        submissions.push({
          hash: meta.submitterHash,
          entry: { companySlug: created.companySlug, status: created.status, createdAt: new Date().toISOString() },
        });
      }
      return { ...created };
    },

    async listSubmissionsBySubmitter(submitterHash: string, sinceIso: string) {
      return submissions.filter((s) => s.hash === submitterHash && s.entry.createdAt >= sinceIso).map((s) => ({ ...s.entry }));
    },

    async listTrackedOffers() {
      return trackedOffers.map((o) => ({ ...o }));
    },

    async listTrackedOffersForViewer(ids: string[]) {
      return trackedOffers.filter((o) => !owners.has(o.id) && (o.isDemo || ids.includes(o.id))).map((o) => ({ ...o }));
    },

    async listTrackedOffersForUser(userId: string) {
      return trackedOffers.filter((o) => !o.isDemo && owners.get(o.id) === userId).map((o) => ({ ...o }));
    },

    async supportsUserOffers() {
      return true;
    },

    async insertTrackedOffer(offer: NewTrackedOffer, ownerUserId?: string) {
      const created: TrackedOffer = { ...offer, id: newId(), alerts: [] };
      trackedOffers.push(created);
      if (ownerUserId) owners.set(created.id, ownerUserId);
      return { ...created };
    },

    async updateTrackedOffer(id: string, changes: TrackedOfferChanges, ownerUserId?: string) {
      const idx = trackedOffers.findIndex((o) => o.id === id && !o.isDemo && owners.get(o.id) === ownerUserId);
      if (idx === -1) return null;
      trackedOffers[idx] = { ...trackedOffers[idx], ...changes };
      return { ...trackedOffers[idx] };
    },
  };
}
