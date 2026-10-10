-- Grant table privileges to the server-side role explicitly.
-- Newer Supabase projects no longer auto-grant privileges on new public tables, so the secret
-- (service_role) key gets "permission denied for table" without this. anon/authenticated stay ungranted.
grant select, insert, update, delete on table public.offer_reports to service_role;
grant select, insert, update, delete on table public.tracked_offers to service_role;
