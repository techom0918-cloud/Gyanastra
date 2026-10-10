// Supabase/PostgreSQL backend. Schema: supabase/migrations/20261010000000_create_offer_tables.sql
import type { SupabaseClient } from '@supabase/supabase-js';
import { OfferReport, OfferStatus, TrackedOffer } from '@/types';
import { NewOfferReport, NewTrackedOffer, Repository, StoreError, TrackedOfferChanges } from './repository';

const REPORTS_TABLE = 'offer_reports';
const TRACKED_TABLE = 'tracked_offers';
// PostgREST caps responses (1000 rows by default), so list queries page through results.
const PAGE_SIZE = 1000;

export interface OfferReportRow {
  id: string;
  company_slug: string;
  company_name: string;
  status: OfferStatus;
  description: string | null;
  delay_weeks: number | string | null; // numeric column
  role: string | null;
  graduation_year: number | null;
  reported_at: string; // date, YYYY-MM-DD
  source_type: OfferReport['sourceType'];
  is_demo: boolean;
}

export interface TrackedOfferRow {
  id: string;
  company_slug: string;
  company_name: string;
  role: string | null;
  offer_date: string | null;
  expected_joining_date: string | null;
  last_communication_date: string | null;
  current_status: OfferStatus;
  notes: string | null;
  is_demo: boolean;
}

// Null columns become absent keys, matching the JSON the in-memory store produced.
function optional<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

export function reportFromRow(row: OfferReportRow): OfferReport {
  return {
    id: row.id,
    companySlug: row.company_slug,
    companyName: row.company_name,
    status: row.status,
    description: optional(row.description),
    delayWeeks: row.delay_weeks === null ? undefined : Number(row.delay_weeks),
    role: optional(row.role),
    graduationYear: optional(row.graduation_year),
    reportedAt: row.reported_at,
    sourceType: row.source_type,
    isDemo: row.is_demo,
  };
}

export function reportToRow(report: NewOfferReport): Omit<OfferReportRow, 'id'> {
  return {
    company_slug: report.companySlug,
    company_name: report.companyName,
    status: report.status,
    description: report.description ?? null,
    delay_weeks: report.delayWeeks ?? null,
    role: report.role ?? null,
    graduation_year: report.graduationYear ?? null,
    reported_at: report.reportedAt,
    source_type: report.sourceType,
    is_demo: report.isDemo ?? false,
  };
}

export function trackedOfferFromRow(row: TrackedOfferRow): TrackedOffer {
  return {
    id: row.id,
    companySlug: row.company_slug,
    companyName: row.company_name,
    role: optional(row.role),
    offerDate: optional(row.offer_date),
    expectedJoiningDate: optional(row.expected_joining_date),
    lastCommunicationDate: optional(row.last_communication_date),
    currentStatus: row.current_status,
    notes: optional(row.notes),
    alerts: [],
    isDemo: row.is_demo,
  };
}

export function trackedOfferToRow(offer: NewTrackedOffer): Omit<TrackedOfferRow, 'id'> {
  return {
    company_slug: offer.companySlug,
    company_name: offer.companyName,
    role: offer.role ?? null,
    offer_date: offer.offerDate ?? null,
    expected_joining_date: offer.expectedJoiningDate ?? null,
    last_communication_date: offer.lastCommunicationDate ?? null,
    current_status: offer.currentStatus,
    notes: offer.notes ?? null,
    is_demo: offer.isDemo ?? false,
  };
}

const CHANGE_COLUMNS: Record<keyof TrackedOfferChanges, keyof TrackedOfferRow> = {
  companySlug: 'company_slug',
  companyName: 'company_name',
  role: 'role',
  offerDate: 'offer_date',
  expectedJoiningDate: 'expected_joining_date',
  lastCommunicationDate: 'last_communication_date',
  currentStatus: 'current_status',
  notes: 'notes',
};

export function trackedOfferChangesToRow(changes: TrackedOfferChanges): Partial<TrackedOfferRow> {
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(CHANGE_COLUMNS)) {
    if (key in changes) row[column] = changes[key as keyof TrackedOfferChanges] ?? null;
  }
  return row as Partial<TrackedOfferRow>;
}

function fail(action: string, error: { message: string }): never {
  throw new StoreError('query_failed', `Supabase ${action} failed: ${error.message}`, { cause: error });
}

export function createSupabaseRepository(client: SupabaseClient): Repository {
  async function listReportRows(slug?: string): Promise<OfferReportRow[]> {
    const rows: OfferReportRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = client.from(REPORTS_TABLE).select('*');
      if (slug !== undefined) query = query.eq('company_slug', slug);
      const { data, error } = await query
        .order('reported_at', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) fail('list offer_reports', error);
      const page = (data ?? []) as OfferReportRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  }

  return {
    mode: 'supabase',

    async listReports() {
      return (await listReportRows()).map(reportFromRow);
    },

    async listReportsByCompany(slug: string) {
      return (await listReportRows(slug)).map(reportFromRow);
    },

    async insertReport(report: NewOfferReport) {
      const { data, error } = await client.from(REPORTS_TABLE).insert(reportToRow(report)).select('*').single();
      if (error) fail('insert offer_reports', error);
      return reportFromRow(data as OfferReportRow);
    },

    async listTrackedOffers() {
      const rows: TrackedOfferRow[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await client
          .from(TRACKED_TABLE)
          .select('*')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) fail('list tracked_offers', error);
        const page = (data ?? []) as TrackedOfferRow[];
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows.map(trackedOfferFromRow);
      }
    },

    async insertTrackedOffer(offer: NewTrackedOffer) {
      const { data, error } = await client.from(TRACKED_TABLE).insert(trackedOfferToRow(offer)).select('*').single();
      if (error) fail('insert tracked_offers', error);
      return trackedOfferFromRow(data as TrackedOfferRow);
    },

    async updateTrackedOffer(id: string, changes: TrackedOfferChanges) {
      const row = { ...trackedOfferChangesToRow(changes), updated_at: new Date().toISOString() };
      const { data, error } = await client.from(TRACKED_TABLE).update(row).eq('id', id).select('*').maybeSingle();
      if (error) fail('update tracked_offers', error);
      return data ? trackedOfferFromRow(data as TrackedOfferRow) : null;
    },
  };
}
