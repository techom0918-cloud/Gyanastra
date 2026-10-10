// Import pipeline for documented outcome records: parse → validate → plan (dry run) → commit.
// Planning only reads the database. Committing only inserts; it never updates or deletes, and
// rows whose import_key already exists are skipped by the database (ON CONFLICT DO NOTHING).
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OfferStatus } from '@/types';
import { parseCsv } from './csv';
import { FieldError, ValidatedRecord, validateRecord, ValidateOptions } from './validate';

const TABLE = 'offer_reports';
const PAGE_SIZE = 1000;
const SLUGS_PER_QUERY = 100;
const INSERT_CHUNK = 500;
/** Two outcomes for the same company/status/role/year reported this close together may be the same event. */
export const POSSIBLE_DUPLICATE_WINDOW_DAYS = 14;

export const PROVENANCE_MIGRATION = 'supabase/migrations/20261010000002_add_report_provenance.sql';

export class ImportError extends Error {}

export type InputFormat = 'csv' | 'json';

export function parseInput(text: string, format: InputFormat): unknown[] {
  if (format === 'csv') return parseCsv(text);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new ImportError(`Invalid JSON: ${(error as Error).message}`);
  }
  if (!Array.isArray(data)) throw new ImportError('JSON input must be an array of records');
  return data;
}

/** Deterministic batch id: the same file imported on the same day gets the same id. */
export function computeBatchId(fileText: string, today: string): string {
  const digest = createHash('sha256').update(fileText).digest('hex').slice(0, 10);
  return `import-${today.replaceAll('-', '')}-${digest}`;
}

/** The subset of an existing offer_reports row needed for duplicate checks. */
export interface ExistingReport {
  id: string;
  company_slug: string;
  status: OfferStatus;
  role: string | null;
  graduation_year: number | null;
  reported_at: string;
  import_key: string | null;
  is_demo: boolean;
}

export type Provenance = 'demo' | 'community' | 'imported';

export function provenanceOf(row: Pick<ExistingReport, 'is_demo' | 'import_key'>): Provenance {
  if (row.is_demo) return 'demo';
  return row.import_key ? 'imported' : 'community';
}

export interface DuplicateMatch {
  /** Existing database row id, or the file row number of an earlier record in the same file. */
  existingId?: string;
  fileRow?: number;
  provenance: Provenance | 'this-file';
  reportedAt: string;
}

export interface ImportPlan {
  batchId: string;
  totalRecords: number;
  toInsert: ValidatedRecord[];
  rejected: { row: number; errors: FieldError[] }[];
  /** Exact duplicates: same import_key already in the database (a re-run) or earlier in this file. */
  alreadyImported: { row: number; existingId: string }[];
  duplicateInFile: { row: number; firstRow: number }[];
  /** Near-duplicates of a different source or a community report; excluded unless explicitly allowed. */
  possibleDuplicates: { row: number; companySlug: string; status: OfferStatus; reportedAt: string; matches: DuplicateMatch[]; included: boolean }[];
}

export interface PlanOptions extends ValidateOptions {
  batchId: string;
  allowPossibleDuplicates?: boolean;
}

export function planImport(records: unknown[], existing: ExistingReport[], options: PlanOptions): ImportPlan {
  const plan: ImportPlan = {
    batchId: options.batchId,
    totalRecords: records.length,
    toInsert: [],
    rejected: [],
    alreadyImported: [],
    duplicateInFile: [],
    possibleDuplicates: [],
  };

  const existingByKey = new Map(existing.filter((e) => e.import_key).map((e) => [e.import_key!, e]));
  // Demo rows are fabricated, so they are never evidence that a real outcome is already recorded.
  const comparable = existing.filter((e) => !e.is_demo);
  const seenInFile = new Map<string, number>();
  const acceptedSoFar: ValidatedRecord[] = [];

  records.forEach((raw, i) => {
    const result = validateRecord(raw, i + 1, options);
    if (!result.ok) {
      plan.rejected.push({ row: result.row, errors: result.errors });
      return;
    }
    const record = result.record;

    const firstRow = seenInFile.get(record.importKey);
    if (firstRow !== undefined) {
      plan.duplicateInFile.push({ row: record.row, firstRow });
      return;
    }
    seenInFile.set(record.importKey, record.row);

    const already = existingByKey.get(record.importKey);
    if (already) {
      plan.alreadyImported.push({ row: record.row, existingId: already.id });
      return;
    }

    const matches: DuplicateMatch[] = [
      ...comparable
        .filter((e) => e.import_key !== record.importKey && isNear(record, e.company_slug, e.status, e.role, e.graduation_year, e.reported_at))
        .map((e) => ({ existingId: e.id, provenance: provenanceOf(e), reportedAt: e.reported_at })),
      ...acceptedSoFar
        .filter((a) => isNear(record, a.companySlug, a.status, a.role ?? null, a.graduationYear ?? null, a.reportedAt))
        .map((a) => ({ fileRow: a.row, provenance: 'this-file' as const, reportedAt: a.reportedAt })),
    ];

    if (matches.length > 0) {
      const included = options.allowPossibleDuplicates === true;
      plan.possibleDuplicates.push({
        row: record.row,
        companySlug: record.companySlug,
        status: record.status,
        reportedAt: record.reportedAt,
        matches,
        included,
      });
      if (!included) return;
    }

    plan.toInsert.push(record);
    acceptedSoFar.push(record);
  });

  return plan;
}

function isNear(
  r: ValidatedRecord,
  slug: string,
  status: OfferStatus,
  role: string | null,
  graduationYear: number | null,
  reportedAt: string
): boolean {
  if (slug !== r.companySlug || status !== r.status) return false;
  // Only compare role/year when both sides state them.
  if (role && r.role && role.trim().toLowerCase() !== r.role.trim().toLowerCase()) return false;
  if (graduationYear !== null && r.graduationYear !== undefined && graduationYear !== r.graduationYear) return false;
  const days = Math.abs(Date.parse(reportedAt) - Date.parse(r.reportedAt)) / 86_400_000;
  return days <= POSSIBLE_DUPLICATE_WINDOW_DAYS;
}

/** The offer_reports row for an imported record. is_demo is always false; provenance columns are always set. */
export function importRow(record: ValidatedRecord, batchId: string) {
  return {
    company_slug: record.companySlug,
    company_name: record.companyName,
    status: record.status,
    description: record.description ?? null,
    delay_weeks: record.delayWeeks ?? null,
    role: record.role ?? null,
    graduation_year: record.graduationYear ?? null,
    reported_at: record.reportedAt,
    source_type: record.sourceType,
    is_demo: false,
    import_key: record.importKey,
    import_batch_id: batchId,
    source_url: record.sourceUrl ?? null,
    source_reference: record.sourceReference ?? null,
    collected_at: record.collectedAt,
    evidence_type: record.evidenceType,
    verification_status: record.verificationStatus,
    verified_at: record.verifiedAt ?? null,
    verification_note: record.verificationNote ?? null,
  };
}

// --- Database access ---

/** Fails with an actionable message when the provenance migration has not been applied. */
export async function assertImportSchema(client: SupabaseClient): Promise<void> {
  const { error } = await client
    .from(TABLE)
    .select('import_key, import_batch_id, source_url, source_reference, collected_at, evidence_type, verification_status, verified_at, verification_note')
    .limit(1);
  if (error) {
    throw new ImportError(`offer_reports is missing the import provenance columns (${error.message}). Apply ${PROVENANCE_MIGRATION} first.`);
  }
}

/** Reads (never writes) the existing reports for the given company slugs. */
export async function fetchExistingReports(client: SupabaseClient, slugs: string[]): Promise<ExistingReport[]> {
  const unique = [...new Set(slugs)];
  const rows: ExistingReport[] = [];
  for (let i = 0; i < unique.length; i += SLUGS_PER_QUERY) {
    const chunk = unique.slice(i, i + SLUGS_PER_QUERY);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from(TABLE)
        .select('id, company_slug, status, role, graduation_year, reported_at, import_key, is_demo')
        .in('company_slug', chunk)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new ImportError(`Reading existing reports failed: ${error.message}`);
      const page = (data ?? []) as ExistingReport[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

/** Validates the records and checks them against the database. Read-only: this is the dry run. */
export async function prepareImport(client: SupabaseClient, records: unknown[], options: PlanOptions): Promise<ImportPlan> {
  await assertImportSchema(client);
  // Validate once to learn which companies to look up; planImport validates again against the real data.
  const slugs = records
    .map((raw, i) => validateRecord(raw, i + 1, options))
    .flatMap((r) => (r.ok ? [r.record.companySlug] : []));
  const existing = slugs.length > 0 ? await fetchExistingReports(client, slugs) : [];
  return planImport(records, existing, options);
}

export interface CommitResult {
  inserted: { row: number; id: string }[];
  /** Rows another import inserted between planning and committing; skipped, not overwritten. */
  skippedConcurrent: number[];
}

/** Inserts plan.toInsert. Existing rows (any provenance) are never updated or deleted. */
export async function commitImport(client: SupabaseClient, plan: ImportPlan): Promise<CommitResult> {
  const result: CommitResult = { inserted: [], skippedConcurrent: [] };
  for (let i = 0; i < plan.toInsert.length; i += INSERT_CHUNK) {
    const chunk = plan.toInsert.slice(i, i + INSERT_CHUNK);
    const { data, error } = await client
      .from(TABLE)
      .upsert(chunk.map((r) => importRow(r, plan.batchId)), { onConflict: 'import_key', ignoreDuplicates: true })
      .select('id, import_key');
    if (error) {
      throw new ImportError(
        `Insert failed after ${result.inserted.length} row(s) were inserted: ${error.message}. ` +
          'Re-running the same file is safe: inserted rows are skipped.'
      );
    }
    const insertedKeys = new Map(((data ?? []) as { id: string; import_key: string }[]).map((d) => [d.import_key, d.id]));
    for (const r of chunk) {
      const id = insertedKeys.get(r.importKey);
      if (id) result.inserted.push({ row: r.row, id });
      else result.skippedConcurrent.push(r.row);
    }
  }
  return result;
}
