-- Aagey Phase 2: provenance for reports imported from documented sources (scripts/import-reports.ts).
-- Additive only: adds nullable columns and constraints. Existing demo and community rows keep NULLs
-- in every new column and are not rewritten. No new tables, so no new grants are needed.
--
-- Provenance of a row:
--   is_demo = true                        → demo (seeded demonstration data)
--   import_key is null, is_demo = false   → community (submitted through the app)
--   import_key is not null                → imported (one documented outcome from a cited source)

alter table public.offer_reports
  -- Deterministic hash of the normalised record + source; a unique key makes re-running an import a no-op.
  add column if not exists import_key          text unique,
  add column if not exists import_batch_id     text check (char_length(import_batch_id) <= 100),
  add column if not exists source_url          text check (char_length(source_url) <= 2000 and source_url ~ '^https?://'),
  -- Citation for sources without a stable URL (e.g. "Placement cell notice, 2026-03-04, ref PC/26/112").
  add column if not exists source_reference    text check (char_length(source_reference) <= 500),
  add column if not exists collected_at        date,
  add column if not exists evidence_type       text check (evidence_type in (
                             'official_notice', 'company_statement', 'news_report', 'self_report')),
  add column if not exists verification_status text check (verification_status in (
                             'unverified', 'self_reported', 'verified')),
  add column if not exists verified_at         date,
  add column if not exists verification_note   text check (char_length(verification_note) <= 1000);

do $$
begin
  -- Imported rows must carry full provenance and can never be demo rows.
  if not exists (select 1 from pg_constraint where conname = 'offer_reports_import_provenance_check') then
    alter table public.offer_reports add constraint offer_reports_import_provenance_check check (
      import_key is null or (
        is_demo = false
        and import_batch_id is not null
        and (source_url is not null or source_reference is not null)
        and collected_at is not null
        and evidence_type is not null
        and verification_status is not null
      )
    );
  end if;

  -- "verified" needs a recorded human review, not just a URL; self-reports can never be "verified".
  if not exists (select 1 from pg_constraint where conname = 'offer_reports_verification_check') then
    alter table public.offer_reports add constraint offer_reports_verification_check check (
      verification_status is distinct from 'verified' or (
        verified_at is not null
        and verification_note is not null
        and evidence_type is distinct from 'self_report'
      )
    );
  end if;
end
$$;

create index if not exists offer_reports_import_batch_idx on public.offer_reports (import_batch_id)
  where import_batch_id is not null;
