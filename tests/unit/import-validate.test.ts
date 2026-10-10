import { describe, expect, it } from 'vitest';
import { parseCsv, CsvParseError } from '@/lib/import/csv';
import { computeImportKey, TEST_TAG, validateRecord, ValidateOptions } from '@/lib/import/validate';

const TODAY = '2026-10-10';
const FIXTURES: ValidateOptions = { today: TODAY, testFixtures: true };
const REAL: ValidateOptions = { today: TODAY };

// Tagged, placeholder-domain record: valid only in test-fixture mode.
const base = {
  companyName: 'Fixture Alpha Ltd',
  status: 'joining_delayed',
  reportedAt: '2026-09-01',
  evidenceType: 'news_report',
  sourceUrl: 'https://example.org/fixture/alpha',
  collectedAt: '2026-09-05',
  description: `${TEST_TAG} fixture`,
};

function errorsFor(raw: object, options = FIXTURES) {
  const result = validateRecord(raw, 1, options);
  return result.ok ? [] : result.errors;
}

function fieldsWithErrors(raw: object, options = FIXTURES) {
  return errorsFor(raw, options).map((e) => e.field);
}

describe('validateRecord', () => {
  it('accepts a complete record and derives slug, provenance and defaults', () => {
    const result = validateRecord({ ...base, delayWeeks: 6, graduationYear: 2026 }, 3, FIXTURES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record).toMatchObject({
      row: 3,
      companySlug: 'fixture-alpha-ltd',
      verificationStatus: 'unverified',
      sourceType: 'public',
      delayWeeks: 6,
    });
    expect(result.record.importKey).toMatch(/^v1:[0-9a-f]{64}$/);
  });

  it('requires the core fields', () => {
    expect(fieldsWithErrors({})).toEqual(
      expect.arrayContaining(['companyName', 'status', 'reportedAt', 'evidenceType', 'collectedAt'])
    );
  });

  it('rejects statuses outside the allowed set', () => {
    expect(fieldsWithErrors({ ...base, status: 'ghosted' })).toContain('status');
  });

  it('rejects malformed, impossible, future and out-of-order dates', () => {
    expect(fieldsWithErrors({ ...base, reportedAt: '01/09/2026' })).toContain('reportedAt');
    expect(fieldsWithErrors({ ...base, reportedAt: '2026-02-30' })).toContain('reportedAt');
    expect(fieldsWithErrors({ ...base, reportedAt: '2026-10-11', collectedAt: '2026-10-11' })).toEqual(
      expect.arrayContaining(['reportedAt', 'collectedAt'])
    );
    expect(fieldsWithErrors({ ...base, collectedAt: '2026-08-01' })).toEqual(['collectedAt']);
    expect(fieldsWithErrors({ ...base, reportedAt: '2014-12-31' })).toContain('reportedAt');
  });

  it('requires a source URL or reference, and refuses non-http URLs', () => {
    expect(fieldsWithErrors({ ...base, sourceUrl: undefined })).toEqual(['sourceUrl']);
    expect(fieldsWithErrors({ ...base, sourceUrl: 'ftp://example.org/x' })).toEqual(['sourceUrl']);
    expect(fieldsWithErrors({ ...base, sourceUrl: undefined, sourceReference: 'Placement cell notice FX/1' })).toEqual([]);
  });

  it('rejects aggregate placement statistics as evidence of an individual outcome', () => {
    const errors = errorsFor({ ...base, evidenceType: 'aggregate_statistic' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ field: 'evidenceType', message: expect.stringContaining('aggregate') });
  });

  it('refuses personal-data fields, pipeline-owned fields and unknown fields', () => {
    expect(fieldsWithErrors({ ...base, studentName: 'x', email: '', isDemo: 'true', sourceType: 'verified', extra: 1 })).toEqual(
      expect.arrayContaining(['studentName', 'email', 'isDemo', 'sourceType', 'extra'])
    );
  });

  it('refuses emails and phone numbers inside free text', () => {
    expect(fieldsWithErrors({ ...base, description: `${TEST_TAG} contact x.y@college.edu` })).toEqual(['description']);
    expect(fieldsWithErrors({ ...base, description: `${TEST_TAG} call +91 98765 43210` })).toEqual(['description']);
  });

  it('only allows delayWeeks on delayed outcomes', () => {
    expect(fieldsWithErrors({ ...base, status: 'joining_confirmed', delayWeeks: 3 })).toEqual(['delayWeeks']);
  });

  describe('verification', () => {
    it('never treats a URL as verification: default is unverified', () => {
      const result = validateRecord(base, 1, FIXTURES);
      expect(result.ok && result.record.verificationStatus).toBe('unverified');
      expect(result.ok && result.record.sourceType).toBe('public');
    });

    it('requires a review date and a substantive note to mark a record verified', () => {
      expect(fieldsWithErrors({ ...base, verificationStatus: 'verified' })).toEqual(['verifiedAt', 'verificationNote']);
      expect(fieldsWithErrors({ ...base, verificationStatus: 'verified', verifiedAt: '2026-09-06', verificationNote: 'ok' })).toEqual([
        'verificationNote',
      ]);
      const verified = validateRecord(
        { ...base, verificationStatus: 'verified', verifiedAt: '2026-09-06', verificationNote: 'Reviewer read the notice and matched company and date' },
        1,
        FIXTURES
      );
      expect(verified.ok && verified.record.sourceType).toBe('verified');
    });

    it('keeps self-reports as self_reported: they cannot be verified or marked unverified', () => {
      const selfReport = { ...base, evidenceType: 'self_report' };
      const result = validateRecord(selfReport, 1, FIXTURES);
      expect(result.ok && result.record).toMatchObject({ verificationStatus: 'self_reported', sourceType: 'community' });
      expect(fieldsWithErrors({ ...selfReport, verificationStatus: 'verified', verifiedAt: '2026-09-06', verificationNote: 'x'.repeat(30) })).toContain(
        'verificationStatus'
      );
      expect(fieldsWithErrors({ ...base, verificationStatus: 'self_reported' })).toEqual(['verificationStatus']);
    });

    it('rejects verifiedAt on records that are not verified', () => {
      expect(fieldsWithErrors({ ...base, verifiedAt: '2026-09-06' })).toEqual(['verifiedAt']);
    });
  });

  describe('outside test-fixture mode', () => {
    it('refuses test-tagged records and placeholder domains', () => {
      expect(fieldsWithErrors(base, REAL)).toEqual(['sourceUrl', 'description']);
    });
  });
});

describe('computeImportKey', () => {
  const key = { companySlug: 'acme', status: 'joining_delayed' as const, reportedAt: '2026-09-01', role: 'Analyst', graduationYear: 2026 };

  it('ignores host case, fragments, trailing slashes and tracking parameters', () => {
    expect(computeImportKey({ ...key, sourceUrl: 'https://News.Site.in/a/b/?utm_source=x&id=2#top' })).toBe(
      computeImportKey({ ...key, role: ' analyst', sourceUrl: 'https://news.site.in/a/b?id=2' })
    );
  });

  it('differs when the source or the claim differs', () => {
    const a = computeImportKey({ ...key, sourceUrl: 'https://news.site.in/a' });
    expect(computeImportKey({ ...key, sourceUrl: 'https://other.site.in/a' })).not.toBe(a);
    expect(computeImportKey({ ...key, status: 'offer_revoked', sourceUrl: 'https://news.site.in/a' })).not.toBe(a);
    expect(computeImportKey({ ...key, sourceReference: 'Notice 1' })).not.toBe(computeImportKey({ ...key, sourceReference: 'Notice 2' }));
  });
});

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, embedded commas/newlines, CRLF and a BOM', () => {
    const rows = parseCsv('﻿a,b\r\n"x, ""y""","line1\nline2"\r\n\r\nplain,\n');
    expect(rows).toEqual([
      { a: 'x, "y"', b: 'line1\nline2' },
      { a: 'plain', b: '' },
    ]);
  });

  it('rejects ragged rows, duplicate headers and unterminated quotes', () => {
    expect(() => parseCsv('a,b\n1\n')).toThrow(CsvParseError);
    expect(() => parseCsv('a,a\n1,2\n')).toThrow(CsvParseError);
    expect(() => parseCsv('a\n"open\n')).toThrow(CsvParseError);
  });
});
