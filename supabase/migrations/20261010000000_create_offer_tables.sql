-- Aagey Phase 1: persistent storage for offer reports and tracked offers.
-- Additive only: creates tables/indexes if they do not exist; never drops or rewrites data.

create table if not exists public.offer_reports (
  id              text primary key default gen_random_uuid()::text,
  company_slug    text not null,
  company_name    text not null check (char_length(company_name) between 2 and 200),
  status          text not null check (status in (
                    'offer_received', 'bg_verification_pending', 'joining_confirmed',
                    'joining_delayed', 'offer_revoked')),
  description     text check (char_length(description) <= 1000),
  delay_weeks     numeric check (delay_weeks between 0 and 200),
  role            text check (char_length(role) <= 200),
  graduation_year integer check (graduation_year between 2015 and 2030),
  reported_at     date not null default current_date,
  source_type     text not null default 'community' check (source_type in ('community', 'verified', 'public')),
  -- true only for seeded demonstration rows; user submissions are always false
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists offer_reports_company_slug_idx on public.offer_reports (company_slug);
create index if not exists offer_reports_reported_at_idx on public.offer_reports (reported_at desc);

create table if not exists public.tracked_offers (
  id                      text primary key default gen_random_uuid()::text,
  company_slug            text not null,
  company_name            text not null check (char_length(company_name) between 2 and 200),
  role                    text check (char_length(role) <= 200),
  -- free-form strings, matching the API contract (TrackedOffer.offerDate etc. are strings)
  offer_date              text,
  expected_joining_date   text,
  last_communication_date text,
  current_status          text not null check (current_status in (
                            'offer_received', 'bg_verification_pending', 'joining_confirmed',
                            'joining_delayed', 'offer_revoked')),
  notes                   text check (char_length(notes) <= 1000),
  is_demo                 boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists tracked_offers_company_slug_idx on public.tracked_offers (company_slug);

-- The app reads/writes only from the server with the secret (service role) key, which bypasses RLS.
-- RLS with no policies blocks the public anon key from reading or writing these tables directly.
alter table public.offer_reports enable row level security;
alter table public.tracked_offers enable row level security;
