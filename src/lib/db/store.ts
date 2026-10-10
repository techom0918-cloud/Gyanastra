// Data access for API routes. Storage backend (Supabase or in-memory) is chosen in ./config.ts.
import 'server-only';
import { OfferReport, TrackedOffer, Company } from '@/types';
import type { TrackedOfferUpdate } from '../validation/schemas';
import { computeReliabilityIndicator } from '../scoring/reliability';
import { generateAlerts } from '../alerts/engine';
import { getRepository } from './config';
import { ReportSubmissionMeta, StorageMode, TrackedOfferChanges } from './repository';
import type { RecentSubmission } from '../abuse/submissions';
import { slugify } from '../slug';

export { slugify };

function byReportedAtDesc(a: OfferReport, b: OfferReport): number {
  return b.reportedAt.localeCompare(a.reportedAt);
}

function groupBySlug(reports: OfferReport[]): Map<string, OfferReport[]> {
  const groups = new Map<string, OfferReport[]>();
  for (const r of reports) {
    const group = groups.get(r.companySlug);
    if (group) group.push(r);
    else groups.set(r.companySlug, [r]);
  }
  return groups;
}

export function getStorageMode(): StorageMode {
  return getRepository().mode;
}

// --- Reports ---
export async function getAllReports(): Promise<OfferReport[]> {
  return (await getRepository().listReports()).sort(byReportedAtDesc);
}

export async function getReportsByCompany(slug: string): Promise<OfferReport[]> {
  return (await getRepository().listReportsByCompany(slug)).sort(byReportedAtDesc);
}

export async function addReport(
  report: Omit<OfferReport, 'id' | 'companySlug' | 'reportedAt' | 'sourceType' | 'isDemo'>,
  meta?: ReportSubmissionMeta
): Promise<OfferReport> {
  return getRepository().insertReport(
    {
      ...report,
      companySlug: slugify(report.companyName),
      reportedAt: new Date().toISOString().slice(0, 10),
      sourceType: 'community',
      isDemo: false,
    },
    meta
  );
}

/** Null when the backend cannot record submitter hashes (see Repository.listSubmissionsBySubmitter). */
export async function getRecentSubmissions(submitterHash: string, sinceIso: string): Promise<RecentSubmission[] | null> {
  return getRepository().listSubmissionsBySubmitter(submitterHash, sinceIso);
}

// --- Companies ---
function summarize(slug: string, companyReports: OfferReport[]): Company | null {
  if (companyReports.length === 0) return null;

  const sorted = [...companyReports].sort(byReportedAtDesc);
  const name = sorted[0].companyName;
  const statusDist: Record<string, number> = {};
  for (const r of sorted) {
    statusDist[r.status] = (statusDist[r.status] || 0) + 1;
  }

  const dates = sorted.map((r) => r.reportedAt).sort();

  return {
    slug,
    name,
    sector: undefined,
    reportCount: sorted.length,
    statusDistribution: statusDist as Company['statusDistribution'],
    reliabilityIndicator: computeReliabilityIndicator(sorted),
    latestReportDate: dates[dates.length - 1],
    oldestReportDate: dates[0],
  };
}

export async function getCompanySlugs(): Promise<string[]> {
  return Array.from(groupBySlug(await getRepository().listReports()).keys());
}

export async function getCompanySummary(slug: string): Promise<Company | null> {
  return summarize(slug, await getRepository().listReportsByCompany(slug));
}

export async function getAllCompanies(): Promise<Company[]> {
  const groups = groupBySlug(await getRepository().listReports());
  return Array.from(groups, ([slug, companyReports]) => summarize(slug, companyReports)!)
    .filter(Boolean)
    .sort((a, b) => b.reportCount - a.reportCount);
}

// --- Tracked Offers ---
/** Who is asking for tracked offers: a signed-in account, or a browser holding private offer ids. */
export type TrackerViewer = { userId: string } | string[];

/** Account offers, or (without an account) demo offers plus the offers whose ids the browser holds. */
export async function getTrackedOffers(viewer: TrackerViewer): Promise<TrackedOffer[]> {
  const repo = getRepository();
  const offersPromise = Array.isArray(viewer) ? repo.listTrackedOffersForViewer(viewer) : repo.listTrackedOffersForUser(viewer.userId);
  const [offers, reports] = await Promise.all([offersPromise, repo.listReports()]);
  const groups = groupBySlug(reports);
  // Alerts are recomputed from current reports on every read; they are never stored.
  // Demo offers are compared with demo reports only, real offers with real reports only.
  return offers.map((offer) => {
    const companyReports = (groups.get(offer.companySlug) ?? [])
      .filter((r) => Boolean(r.isDemo) === Boolean(offer.isDemo))
      .sort(byReportedAtDesc);
    return {
      ...offer,
      alerts: generateAlerts(offer, companyReports),
    };
  });
}

/** False until the accounts migration (tracked_offers.user_id) has been applied. */
export async function supportsAccountTracking(): Promise<boolean> {
  return getRepository().supportsUserOffers();
}

export async function addTrackedOffer(
  input: Omit<TrackedOffer, 'id' | 'companySlug' | 'alerts'>,
  ownerUserId?: string
): Promise<TrackedOffer> {
  return getRepository().insertTrackedOffer(
    {
      ...input,
      companySlug: slugify(input.companyName),
      isDemo: false,
    },
    ownerUserId
  );
}

export async function updateTrackedOffer(id: string, updates: TrackedOfferUpdate, ownerUserId?: string): Promise<TrackedOffer | null> {
  const changes: TrackedOfferChanges = { ...updates };
  if (updates.companyName !== undefined) changes.companySlug = slugify(updates.companyName);
  return getRepository().updateTrackedOffer(id, changes, ownerUserId);
}

// --- Stats ---
export async function getDashboardStats() {
  const reports = await getRepository().listReports();
  const total = reports.length;
  const companies = groupBySlug(reports).size;
  const delayed = reports.filter((r) => r.status === 'joining_delayed').length;
  const revoked = reports.filter((r) => r.status === 'offer_revoked').length;
  const confirmed = reports.filter((r) => r.status === 'joining_confirmed').length;
  // How many of the totals are synthetic demo records, so the UI can label them truthfully.
  const demo = reports.filter((r) => r.isDemo).length;

  return { total, companies, delayed, revoked, confirmed, demo };
}
