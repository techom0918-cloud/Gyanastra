-- Aagey Career Intelligence: private, user-owned career profiles, assessments and action-plan progress.
-- Additive only: creates three new tables, their indexes, grants and RLS policies. It does not alter, read or rewrite
-- any existing table or row (offer_reports, tracked_offers are untouched).
--
-- Access model (different from the older tables on purpose): the app reads and writes these tables with the SIGNED-IN
-- USER'S OWN session (publishable key + the user's JWT), never with the service_role key. Row Level Security is the
-- enforcement point: every policy requires user_id = auth.uid(), so a user can only ever see or change their own rows,
-- even if application code had a bug. The server also sets user_id from the validated session on every insert.
-- The anon role gets no privileges at all.
--
-- Retention / erasure: every table cascades from auth.users, so deleting a user from Authentication deletes all of
-- their career data. Users can also delete their own data from the app (DELETE /api/career), and the app keeps only
-- the 10 most recent assessments of each kind.

-- 1. One profile per user. Sensitive fields (notice period, financial runway, exit reasons) are nullable and optional.
create table if not exists public.career_profiles (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  status                text not null check (status in ('student', 'offer_received', 'employed', 'seeking', 'other')),
  current_job_title     text check (char_length(current_job_title) <= 100),
  target_role           text check (char_length(target_role) <= 100),
  industry              text check (char_length(industry) <= 100),
  experience_months     integer check (experience_months between 0 and 600),
  tenure_months         integer check (tenure_months between 0 and 600),
  skills                text[] not null default '{}' check (cardinality(skills) <= 20),
  growth_skills         text[] not null default '{}' check (cardinality(growth_skills) <= 10),
  goals                 text check (char_length(goals) <= 600),
  priorities            text[] not null default '{}' check (cardinality(priorities) <= 8),
  salary_min_lpa        numeric(8, 2) check (salary_min_lpa between 0 and 1000),
  salary_max_lpa        numeric(8, 2) check (salary_max_lpa between 0 and 1000),
  preferred_locations   text[] not null default '{}' check (cardinality(preferred_locations) <= 10),
  concerns              text[] not null default '{}' check (cardinality(concerns) <= 8),
  exit_reasons          text[] not null default '{}' check (cardinality(exit_reasons) <= 8),
  notice_period_days    integer check (notice_period_days between 0 and 365),
  financial_runway_months numeric(5, 1) check (financial_runway_months between 0 and 120),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (salary_min_lpa is null or salary_max_lpa is null or salary_min_lpa <= salary_max_lpa)
);

-- 2. Immutable assessment snapshots: the inputs used, the validated result (which includes its supporting evidence),
--    and whether rules or AI produced it. Never updated, only inserted and deleted.
create table if not exists public.career_assessments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  kind           text not null check (kind in ('offer_risk', 'job_stability', 'action_plan')),
  source         text not null default 'rules' check (source in ('rules', 'ai')),
  schema_version smallint not null default 1,
  input          jsonb not null check (pg_column_size(input) <= 20000),
  result         jsonb not null check (pg_column_size(result) <= 60000),
  created_at     timestamptz not null default now(),
  -- lets career_task_progress reference (id, user_id) so progress can never point at someone else's assessment
  unique (id, user_id)
);

create index if not exists career_assessments_user_kind_idx
  on public.career_assessments (user_id, kind, created_at desc);

-- 3. Optional progress ticks for the tasks of an action plan.
create table if not exists public.career_task_progress (
  user_id       uuid not null references auth.users (id) on delete cascade,
  assessment_id uuid not null,
  task_id       text not null check (char_length(task_id) between 1 and 40),
  completed_at  timestamptz not null default now(),
  primary key (assessment_id, task_id),
  foreign key (assessment_id, user_id) references public.career_assessments (id, user_id) on delete cascade
);

-- Privileges: signed-in users only, and only the verbs each table needs. anon gets nothing.
revoke all on table public.career_profiles, public.career_assessments, public.career_task_progress from anon;
grant select, insert, update, delete on table public.career_profiles to authenticated;
grant select, insert, delete on table public.career_assessments to authenticated;
grant select, insert, update, delete on table public.career_task_progress to authenticated;

alter table public.career_profiles enable row level security;
alter table public.career_assessments enable row level security;
alter table public.career_task_progress enable row level security;

-- Policies are dropped first (only these new ones) so the file can be re-run safely.
-- (select auth.uid()) is evaluated once per statement instead of once per row.
drop policy if exists career_profiles_select_own on public.career_profiles;
create policy career_profiles_select_own on public.career_profiles
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists career_profiles_insert_own on public.career_profiles;
create policy career_profiles_insert_own on public.career_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists career_profiles_update_own on public.career_profiles;
create policy career_profiles_update_own on public.career_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists career_profiles_delete_own on public.career_profiles;
create policy career_profiles_delete_own on public.career_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists career_assessments_select_own on public.career_assessments;
create policy career_assessments_select_own on public.career_assessments
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists career_assessments_insert_own on public.career_assessments;
create policy career_assessments_insert_own on public.career_assessments
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists career_assessments_delete_own on public.career_assessments;
create policy career_assessments_delete_own on public.career_assessments
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists career_task_progress_select_own on public.career_task_progress;
create policy career_task_progress_select_own on public.career_task_progress
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists career_task_progress_insert_own on public.career_task_progress;
create policy career_task_progress_insert_own on public.career_task_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists career_task_progress_update_own on public.career_task_progress;
create policy career_task_progress_update_own on public.career_task_progress
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists career_task_progress_delete_own on public.career_task_progress;
create policy career_task_progress_delete_own on public.career_task_progress
  for delete to authenticated using (user_id = (select auth.uid()));
