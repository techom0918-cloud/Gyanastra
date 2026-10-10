-- Aagey: abuse controls for anonymous report submission (src/lib/abuse/submissions.ts).
-- Additive only: one nullable column and one partial index. Existing rows keep NULL and are not rewritten.
-- No new tables, so no new grants: service_role already has table-level privileges on offer_reports.
--
-- submitter_hash = HMAC-SHA256(server secret, "<UTC day>|<client network address>"), first 32 hex chars.
-- The address itself is never stored, and hashes from different days cannot be linked to each other.
-- It is used only to enforce per-submitter limits (3 per 10 minutes, 10 per UTC day, no same-day duplicates)
-- and is never returned by the API.
--
-- Until this is applied, the app keeps working and falls back to a per-instance (non-global) limit.

alter table public.offer_reports
  add column if not exists submitter_hash text check (char_length(submitter_hash) <= 64);

create index if not exists offer_reports_submitter_recent_idx
  on public.offer_reports (submitter_hash, created_at)
  where submitter_hash is not null;

-- Optional retention (NOT run by this migration). Hashes are useless after their UTC day ends;
-- an operator may clear old ones periodically, e.g.:
--   update public.offer_reports set submitter_hash = null
--   where submitter_hash is not null and created_at < now() - interval '2 days';
