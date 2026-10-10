# Importing documented offer outcomes

This pipeline loads **documented, individual offer outcomes** into `offer_reports`. Run it from the
command line with `npm run import:reports`. It never deletes or overwrites rows, it keeps imported rows
apart from demo and community rows, and a URL alone never makes a claim "verified".

> No real records have been imported yet. `data/import-template.csv` contains only the header row.

## 1. What counts as an importable record

One row is **one documented outcome**: a specific offer (or a specific announced group of offers) that the
source says was received, delayed, revoked, put on hold for background verification, or confirmed for joining.

| Source says… | Importable? |
|---|---|
| "Company X postponed joining for its 2026 campus hires from July to October" (company notice, news report quoting the company or a placement cell) | Yes. **One** row with status `joining_delayed`. Do not split it into one row per affected student. |
| A student's own account of their offer outcome, collected with their consent | Yes, as `evidenceType: self_report`. It stays `self_reported` and is never verified. |
| "Institute Y placed 92% of students; median CTC ₹8 LPA" (NIRF data, annual placement reports, brochures) | **No.** Aggregate statistics don't show that any individual offer was delayed or revoked. The importer rejects `evidenceType: aggregate_statistic`. |
| A rumour, forum post with no identifiable outcome, or an anonymous screenshot | No. |
| Anything behind a student-only login, placement portal, private group or paywall you can't share | No. Don't scrape, copy or bypass access controls. |

## 2. Data sources: research checklist

No specific source has been verified for this project yet. Before adding a source, check each item and
record the outcome in your notes.

**Candidate source types (all public, no login):**
- Company press releases, investor/stock-exchange filings and earnings-call transcripts that talk about
  campus hiring, onboarding delays or revoked offers.
- Official notices published openly by a college placement cell, such as a public notice board page or a
  public PDF.
- News reports that cite a named company statement, a placement-cell notice or official records. A report
  repeating anonymous claims is at most `news_report` + `unverified`.
- Labour-ministry or regulator statements, or court/tribunal orders, that name a company and an outcome.
- Aagey's own community submissions, which arrive through the app. They don't need importing.
- Consent-based self-reports you collect yourself, for example a form with explicit consent text. Keep the
  consent records outside Aagey.

**For each source, check:**
1. Is it publicly accessible without logging in, and do its terms allow you to cite it and record the facts?
   Record facts and a link only. Don't copy articles or documents.
2. Does it state a specific outcome (status) for a named company, not just an aggregate statistic?
3. Can you pin down the date the outcome was reported? That becomes `reportedAt`, which drives recency in scoring.
4. Does it identify or expose any individual student? If so, record only the non-identifying facts.
5. Is it a primary source (company or institute) or secondary (news)? Set `evidenceType` to match.
6. Has the same outcome already been recorded from another source? The importer flags these, but check too.
7. If you plan to mark it `verified`: who reviewed it, when, and what exactly did they confirm? That
   goes in `verifiedAt` and `verificationNote`.

## 3. Canonical record → database mapping

The API contract (`OfferReport` in `src/types/index.ts`) is unchanged. The provenance columns added by
`supabase/migrations/20261010000002_add_report_provenance.sql` are stored but not returned by `/api/*`.

| Import field | Required | Column | Rules |
|---|---|---|---|
| `companyName` | yes | `company_name`, `company_slug` | 2–200 chars. The slug is derived exactly as for app submissions. |
| `status` | yes | `status` | `offer_received`, `bg_verification_pending`, `joining_confirmed`, `joining_delayed`, `offer_revoked` |
| `reportedAt` | yes | `reported_at` | `YYYY-MM-DD`, a real date, not before 2015-01-01 and not in the future. **The date the source reported the outcome.** |
| `role` | no | `role` | ≤ 200 chars |
| `graduationYear` | no | `graduation_year` | 2015–2030 |
| `delayWeeks` | no | `delay_weeks` | 0–200, only with `joining_delayed` |
| `description` | no | `description` | ≤ 1000 chars, a factual summary. No emails or phone numbers. |
| `evidenceType` | yes | `evidence_type` | `official_notice`, `company_statement`, `news_report`, `self_report` (`aggregate_statistic` is always rejected) |
| `sourceUrl` | one of these two | `source_url` | Public http(s) URL. Placeholder domains such as example.com are rejected. |
| `sourceReference` | one of these two | `source_reference` | Citation when there's no stable URL, e.g. "Placement cell notice PC/26/112, 2026-03-04" |
| `collectedAt` | yes | `collected_at` | Date you recorded it, on or after `reportedAt` |
| `verificationStatus` | no | `verification_status` | Defaults to `unverified`, or `self_reported` for self-reports. See below. |
| `verifiedAt` | if verified | `verified_at` | Date of the human review |
| `verificationNote` | if verified | `verification_note` | ≥ 20 chars: what was checked and against what |
| *(set by pipeline)* | — | `import_key` | Hash of company, status, date, role, year and normalised source; unique |
| *(set by pipeline)* | — | `import_batch_id` | `import-YYYYMMDD-<file hash>` |
| *(set by pipeline)* | — | `is_demo` | Always `false` (enforced by a database constraint) |
| *(set by pipeline)* | — | `source_type` | `verified` if verified; `community` for self-reports; otherwise `public` |

**Rejected outright:** unknown columns and personal or pipeline-owned columns (`name`, `studentName`,
`email`, `phone`, `rollNumber`, `offerLetter`, `id`, `companySlug`, `sourceType`, `isDemo`). Free text
containing an email address or phone number is also rejected.

**Provenance of any row:** `is_demo = true` → demo; `import_key` set → imported; otherwise → community
(submitted in the app).

**Verification levels:**
- `unverified`: a cited source exists, but nobody has confirmed the source establishes this outcome. This is the default.
- `self_reported`: a first-hand account. It can't be promoted to `verified` through this pipeline.
- `verified`: a reviewer confirmed the source states this outcome. It needs `verifiedAt` and a
  `verificationNote`, and the database enforces both (`offer_reports_verification_check`).

## 4. Running an import

One-time setup: run `supabase/migrations/20261010000002_add_report_provenance.sql` in the Supabase SQL
Editor. It only adds nullable columns and constraints. It doesn't touch existing rows and needs no new grants.

```bash
# 1. Validate the file without touching the database (no credentials needed)
npm run import:reports -- data/my-batch.csv --offline

# 2. Dry run against the database: validation plus duplicate checks. Reads only; writes nothing.
npm run import:reports -- data/my-batch.csv --report=import-report.json

# 3. Insert. Prints the plan, then asks you to type the batch id to confirm.
npm run import:reports -- data/my-batch.csv --commit
#    Non-interactive: --commit --confirm=import-YYYYMMDD-xxxxxxxxxx (the id shown by the dry run)
```

Start from `data/import-template.csv` (CSV) or use a JSON array of objects with the same field names.
Exit codes: `0` ok, `1` error or confirmation refused, `2` dry run finished with rejected rows.

**How each kind of duplicate is handled:**
- *Already imported* (same `import_key` in the database): skipped. Re-running a file is always safe.
- *Duplicate within the file*: the later row is skipped.
- *Possible duplicate*: same company, status, role and year (when both sides state them), reported within 14
  days of a community report, an earlier import or another row in the file. These are **held** and not inserted.
  Review them, then re-run with `--allow-possible-duplicates` if they really are separate outcomes.
  Demo rows are never treated as matches.
- If the same `import_key` is inserted by someone else between the dry run and commit, the database
  skips it (`ON CONFLICT DO NOTHING`). Existing rows are never updated.

**Undoing a batch:** delete it manually in the SQL Editor:
`delete from offer_reports where import_batch_id = '<batch id>';`
The pipeline never deletes anything itself.

## 5. Tests

- `tests/unit/import-validate.test.ts` and `tests/unit/import-pipeline.test.ts` cover validation, duplicates,
  dry-run read-only behaviour, provenance and commit semantics. They need no database.
- `tests/integration/import.test.ts` runs the pipeline against the live database (`AAGEY_DB_TEST=1`). It skips
  with a message until the provenance migration is applied, and deletes only its own `import-test-<timestamp>` batch.
- Fixtures (`tests/fixtures/import/`) are tagged `[aagey-integration-test]` and use `example.org`
  URLs. The real importer refuses both, so fixtures can never be imported as genuine data.
