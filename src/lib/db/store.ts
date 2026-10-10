// Data access for API routes. Storage backend (Supabase or in-memory) is chosen in ./config.ts.
import 'server-only';
import { OfferReport, TrackedOffer, Company } from '@/types';
import type { TrackedOfferUpdate } from '../validation/schemas';
import { computeReliabilityIndicator } from '../scoring/reliability';
import { generateAlerts } from '../alerts/engine';
import { getRepository } from './config';
import { StorageMode, TrackedOfferChanges } from './repository';
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
  report: Omit<OfferReport, 'id' | 'companySlug' | 'reportedAt' | 'sourceType' | 'isDemo'>
): Promise<OfferReport> {
  return getRepository().insertReport({
    ...report,
    companySlug: slugify(report.companyName),
    reportedAt: new Date().toISOString().slice(0, 10),
    sourceType: 'community',
    isDemo: false,
  });
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
export async function getTrackedOffers(): Promise<TrackedOffer[]> {
  const repo = getRepository();
  const [offers, reports] = await Promise.all([repo.listTrackedOffers(), repo.listReports()]);
  const groups = groupBySlug(reports);
  // Alerts are recomputed from current reports on every read; they are never stored.
  return offers.map((offer) => {
    const companyReports = (groups.get(offer.companySlug) ?? []).sort(byReportedAtDesc);
    return {
      ...offer,
      alerts: generateAlerts(offer, companyReports),
    };
  });
}

export async function addTrackedOffer(input: Omit<TrackedOffer, 'id' | 'companySlug' | 'alerts'>): Promise<TrackedOffer> {
  return getRepository().insertTrackedOffer({
    ...input,
    companySlug: slugify(input.companyName),
    isDemo: false,
  });
}

export async function updateTrackedOffer(id: string, updates: TrackedOfferUpdate): Promise<TrackedOffer | null> {
  const changes: TrackedOfferChanges = { ...updates };
  if (updates.companyName !== undefined) changes.companySlug = slugify(updates.companyName);
  return getRepository().updateTrackedOffer(id, changes);
}

// --- Stats ---
export async function getDashboardStats() {
  const reports = await getRepository().listReports();
  const total = reports.length;
  const companies = groupBySlug(reports).size;
  const delayed = reports.filter((r) => r.status === 'joining_delayed').length;
  const revoked = reports.filter((r) => r.status === 'offer_revoked').length;
  const confirmed = reports.filter((r) => r.status === 'joining_confirmed').length;

  return { total, companies, delayed, revoked, confirmed };
}
