-- Aagey accounts: lets a signed-in user own tracked offers (src/lib/db/*-repository.ts, src/app/api/tracker).
-- Additive only: one nullable column and one partial index. Existing rows keep user_id = NULL (they stay
-- "browser-held" offers exactly as before) and are not rewritten. No new tables, so no new grants are needed.
--
-- Access model (unchanged): the app reads and writes this table only on the server, with the secret
-- (service_role) key, which bypasses Row Level Security. RLS stays ENABLED with NO policies, so the public anon key
-- and signed-in users' own JWTs still cannot read or write the table directly. Ownership is therefore enforced in
-- the server code (every query for account offers filters on user_id), and this migration deliberately adds NO
-- policies: adding "owner can select/update" policies would open a second, direct access path that the app does
-- not use. If you ever want one, review it separately.
--
-- ON DELETE CASCADE: deleting a user from Authentication also deletes their tracked offers (right to erasure).
-- Deleting the user is the only thing that triggers it.
--
-- Until this is applied the app keeps working: account offer tracking reports "not enabled yet", and anonymous
-- (browser-held) tracking is unchanged.

alter table public.tracked_offers
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists tracked_offers_user_idx
  on public.tracked_offers (user_id, created_at)
  where user_id is not null;
