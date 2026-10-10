// Validation for documented outcome records imported by scripts/import-reports.ts.
// One record = one documented offer outcome (an individual report or one company notice), never an
// aggregate placement statistic. See docs/data-import.md for the field reference.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { OfferReport, OfferStatus } from '@/types';
import { offerStatusSchema, reportSubmissionSchema } from '@/lib/validation/schemas';
import { slugify } from '@/lib/slug';

export const EVIDENCE_TYPES = ['official_notice', 'company_statement', 'news_report', 'self_report'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const VERIFICATION_STATUSES = ['unverified', 'self_reported', 'verified'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Tag carried by test fixtures; refused unless a test opts in with `testFixtures`. */
export const TEST_TAG = '[aagey-integration-test]';

const EARLIEST_REPORT_DATE = '2015-01-01';
const MIN_VERIFICATION_NOTE = 20;

const ACCEPTED_FIELDS = [
  'companyName', 'status', 'reportedAt', 'role', 'graduationYear', 'delayWeeks', 'description',
  'evidenceType', 'sourceUrl', 'sourceReference', 'collectedAt',
  'verificationStatus', 'verifiedAt', 'verificationNote',
] as const;

// Fields people tend to add that must never be imported (PII, documents, or values the pipeline sets itself).
const REFUSED_FIELDS: Record<string, string> = {
  name: 'personal names are not stored',
  studentName: 'personal names are not stored',
  email: 'email addresses are not stored',
  phone: 'phone numbers are not stored',
  rollNumber: 'student identifiers are not stored',
  offerLetter: 'offer letters and documents are not stored',
  id: 'ids are assigned by the database',
  companySlug: 'derived from companyName',
  sourceType: 'derived from evidenceType and verificationStatus',
  isDemo: 'imported records are never demo records',
};

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'is not a real calendar date');

const base = reportSubmissionSchema.shape;
const recordSchema = z.object({
  companyName: base.companyName,
  status: offerStatusSchema,
  reportedAt: isoDate,
  role: base.role,
  graduationYear: base.graduationYear,
  delayWeeks: base.delayWeeks,
  description: base.description,
  // aggregate_statistic is recognised only so it can be rejected with a clear reason.
  evidenceType: z.enum([...EVIDENCE_TYPES, 'aggregate_statistic']),
  sourceUrl: z.string().max(2000).optional(),
  sourceReference: z.string().max(500).optional(),
  collectedAt: isoDate,
  verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
  verifiedAt: isoDate.optional(),
  verificationNote: z.string().max(1000).optional(),
});

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidatedRecord {
  /** 1-based position in the input file. */
  row: number;
  companySlug: string;
  companyName: string;
  status: OfferStatus;
  /** When the source published/reported the outcome — drives recency in scoring. */
  reportedAt: string;
  role?: string;
  graduationYear?: number;
  delayWeeks?: number;
  description?: string;
  evidenceType: EvidenceType;
  sourceUrl?: string;
  sourceReference?: string;
  collectedAt: string;
  verificationStatus: VerificationStatus;
  verifiedAt?: string;
  verificationNote?: string;
  sourceType: OfferReport['sourceType'];
  importKey: string;
}

export type ValidationResult = { ok: true; record: ValidatedRecord } | { ok: false; row: number; errors: FieldError[] };

export interface ValidateOptions {
  /** YYYY-MM-DD; dates after this are rejected. */
  today: string;
  /** Tests only: accept TEST_TAG and reserved placeholder domains (example.org etc.), which real imports refuse. */
  testFixtures?: boolean;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// 10+ digits, optionally with +, spaces, dots or dashes between them (Indian and international numbers).
const PHONE = /\+?\d(?:[\s.-]?\d){9,}/;
const RESERVED_HOST = /(^|\.)(example\.(com|net|org)|localhost|example|test|invalid|local)$/i;

export function validateRecord(raw: unknown, row: number, options: ValidateOptions): ValidationResult {
  const errors: FieldError[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, row, errors: [{ field: '(record)', message: 'must be an object' }] };
  }

  const input = normalizeInput(raw as Record<string, unknown>);
  for (const key of Object.keys(raw)) {
    if (key in REFUSED_FIELDS) errors.push({ field: key, message: `not accepted: ${REFUSED_FIELDS[key]}` });
    else if (!(ACCEPTED_FIELDS as readonly string[]).includes(key)) errors.push({ field: key, message: 'unknown field' });
  }

  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({ field: issue.path.join('.') || '(record)', message: issue.message });
    }
    return { ok: false, row, errors };
  }
  const r = parsed.data;

  if (r.evidenceType === 'aggregate_statistic') {
    errors.push({
      field: 'evidenceType',
      message: 'aggregate placement statistics do not establish an individual offer outcome; record them elsewhere',
    });
    return { ok: false, row, errors };
  }
  const evidenceType = r.evidenceType;

  const companySlug = slugify(r.companyName);
  if (!companySlug) errors.push({ field: 'companyName', message: 'must contain at least one letter or digit' });

  // --- Provenance ---
  if (!r.sourceUrl && !r.sourceReference) {
    errors.push({ field: 'sourceUrl', message: 'sourceUrl or sourceReference is required' });
  }
  if (r.sourceUrl) {
    const urlError = checkSourceUrl(r.sourceUrl, options.testFixtures === true);
    if (urlError) errors.push({ field: 'sourceUrl', message: urlError });
  }

  // --- Verification: a URL alone never makes a record verified ---
  const verificationStatus: VerificationStatus =
    r.verificationStatus ?? (evidenceType === 'self_report' ? 'self_reported' : 'unverified');
  if (evidenceType === 'self_report' && verificationStatus !== 'self_reported') {
    errors.push({ field: 'verificationStatus', message: 'self_report evidence must have verificationStatus "self_reported"' });
  }
  if (evidenceType !== 'self_report' && verificationStatus === 'self_reported') {
    errors.push({ field: 'verificationStatus', message: '"self_reported" is only valid with evidenceType "self_report"' });
  }
  if (verificationStatus === 'verified') {
    if (!r.verifiedAt) errors.push({ field: 'verifiedAt', message: 'required when verificationStatus is "verified"' });
    if (!r.verificationNote || r.verificationNote.length < MIN_VERIFICATION_NOTE) {
      errors.push({
        field: 'verificationNote',
        message: `required when verificationStatus is "verified": describe what the reviewer checked (at least ${MIN_VERIFICATION_NOTE} characters)`,
      });
    }
  } else if (r.verifiedAt) {
    errors.push({ field: 'verifiedAt', message: 'only allowed when verificationStatus is "verified"' });
  }

  // --- Dates ---
  if (r.reportedAt < EARLIEST_REPORT_DATE) errors.push({ field: 'reportedAt', message: `must be on or after ${EARLIEST_REPORT_DATE}` });
  if (r.reportedAt > options.today) errors.push({ field: 'reportedAt', message: 'is in the future' });
  if (r.collectedAt > options.today) errors.push({ field: 'collectedAt', message: 'is in the future' });
  if (r.collectedAt < r.reportedAt) errors.push({ field: 'collectedAt', message: 'is before reportedAt' });
  if (r.verifiedAt) {
    if (r.verifiedAt > options.today) errors.push({ field: 'verifiedAt', message: 'is in the future' });
    if (r.verifiedAt < r.reportedAt) errors.push({ field: 'verifiedAt', message: 'is before reportedAt' });
  }

  if (r.delayWeeks !== undefined && r.status !== 'joining_delayed') {
    errors.push({ field: 'delayWeeks', message: 'only allowed when status is "joining_delayed"' });
  }

  // --- Privacy and placeholder guards ---
  const textFields = ['description', 'role', 'sourceReference', 'verificationNote', 'sourceUrl'] as const;
  for (const field of textFields) {
    const value = r[field];
    if (!value) continue;
    if (EMAIL.test(value)) errors.push({ field, message: 'contains an email address; remove personal data' });
    if (field !== 'sourceUrl' && PHONE.test(value)) errors.push({ field, message: 'contains a phone number; remove personal data' });
    if (!options.testFixtures && value.includes(TEST_TAG)) {
      errors.push({ field, message: 'contains the integration-test tag; test fixtures are never imported' });
    }
  }

  if (errors.length > 0) return { ok: false, row, errors };

  const sourceType: OfferReport['sourceType'] =
    verificationStatus === 'verified' ? 'verified' : evidenceType === 'self_report' ? 'community' : 'public';

  const record: ValidatedRecord = {
    row,
    companySlug,
    companyName: r.companyName,
    status: r.status,
    reportedAt: r.reportedAt,
    role: r.role,
    graduationYear: r.graduationYear,
    delayWeeks: r.delayWeeks,
    description: r.description,
    evidenceType,
    sourceUrl: r.sourceUrl,
    sourceReference: r.sourceReference,
    collectedAt: r.collectedAt,
    verificationStatus,
    verifiedAt: r.verifiedAt,
    verificationNote: r.verificationNote,
    sourceType,
    importKey: '',
  };
  record.importKey = computeImportKey(record);
  return { ok: true, record };
}

/** Trims strings, turns empty strings into "absent", and parses numeric CSV cells. */
function normalizeInput(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(ACCEPTED_FIELDS as readonly string[]).includes(key)) continue;
    let v = typeof value === 'string' ? value.trim() : value;
    if (v === '' || v === null) continue;
    if ((key === 'graduationYear' || key === 'delayWeeks') && typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
      v = Number(v);
    }
    out[key] = v;
  }
  return out;
}

function checkSourceUrl(value: string, allowReservedHost: boolean): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'is not a valid URL';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'must use http or https';
  if (url.username || url.password) return 'must not contain credentials';
  if (!allowReservedHost && RESERVED_HOST.test(url.hostname)) return 'uses a reserved placeholder domain; cite the real source';
  return null;
}

/** Canonical form of a source URL for duplicate detection: ignores case of host, fragments, tracking params, trailing slash. */
export function normalizeSourceUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ['fbclid', 'gclid', 'ref'].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : '';
  return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Deterministic identity of an imported outcome: the same claim from the same source always hashes the same,
 * so re-running an import skips it. Free text (description, notes) and delayWeeks are excluded on purpose:
 * editing them in the file does not create a second copy of the same outcome.
 */
export function computeImportKey(r: Pick<ValidatedRecord, 'companySlug' | 'status' | 'reportedAt' | 'role' | 'graduationYear' | 'sourceUrl' | 'sourceReference'>): string {
  const source = r.sourceUrl
    ? normalizeSourceUrl(r.sourceUrl)
    : `ref:${normalizeText(r.sourceReference ?? '')}`;
  const parts = [r.companySlug, r.status, r.reportedAt, normalizeText(r.role ?? ''), r.graduationYear ?? '', source];
  return `v1:${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`;
}
