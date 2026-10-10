// In-memory backend: used when Supabase is not configured. Data is lost on restart.
import { OfferReport, TrackedOffer } from '@/types';
import { SEED_REPORTS, SEED_TRACKED_OFFERS } from './seed';
import { NewOfferReport, NewTrackedOffer, Repository, TrackedOfferChanges } from './repository';

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createMemoryRepository(
  seedReports: OfferReport[] = SEED_REPORTS,
  seedTrackedOffers: TrackedOffer[] = SEED_TRACKED_OFFERS
): Repository {
  const reports: OfferReport[] = seedReports.map((r) => ({ ...r }));
  const trackedOffers: TrackedOffer[] = seedTrackedOffers.map((o) => ({ ...o, alerts: [] }));

  return {
    mode: 'memory',

    async listReports() {
      return reports.map((r) => ({ ...r }));
    },

    async listReportsByCompany(slug: string) {
      return reports.filter((r) => r.companySlug === slug).map((r) => ({ ...r }));
    },

    async insertReport(report: NewOfferReport) {
      const created: OfferReport = { ...report, id: newId() };
      reports.push(created);
      return { ...created };
    },

    async listTrackedOffers() {
      return trackedOffers.map((o) => ({ ...o }));
    },

    async insertTrackedOffer(offer: NewTrackedOffer) {
      const created: TrackedOffer = { ...offer, id: newId(), alerts: [] };
      trackedOffers.push(created);
      return { ...created };
    },

    async updateTrackedOffer(id: string, changes: TrackedOfferChanges) {
      const idx = trackedOffers.findIndex((o) => o.id === id);
      if (idx === -1) return null;
      trackedOffers[idx] = { ...trackedOffers[idx], ...changes };
      return { ...trackedOffers[idx] };
    },
  };
}
