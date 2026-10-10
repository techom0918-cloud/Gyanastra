-- Demo seed data for Aagey. Generated from src/lib/db/seed.ts — every row is is_demo = true.
-- These are demonstration records, NOT real or verified reports.
-- Idempotent: rows that already exist (same id) are left untouched; nothing is deleted.

insert into public.offer_reports
  (id, company_slug, company_name, status, description, delay_weeks, role, graduation_year, reported_at, source_type, is_demo)
values
  ('demo-infosys-1', 'infosys', 'Infosys', 'joining_confirmed', null, null, 'Systems Engineer', 2026, '2026-08-12', 'community', true),
  ('demo-infosys-2', 'infosys', 'Infosys', 'joining_delayed', 'Joining pushed from July to October. No clear communication.', 12, 'Systems Engineer', 2026, '2026-09-01', 'community', true),
  ('demo-infosys-3', 'infosys', 'Infosys', 'joining_confirmed', null, null, 'Digital Specialist', 2026, '2026-07-20', 'community', true),
  ('demo-infosys-4', 'infosys', 'Infosys', 'joining_delayed', 'Delayed by 6 weeks, then confirmed.', 6, 'Systems Engineer', 2025, '2026-06-15', 'community', true),
  ('demo-infosys-5', 'infosys', 'Infosys', 'bg_verification_pending', null, null, 'Systems Engineer', 2026, '2026-09-20', 'community', true),
  ('demo-infosys-6', 'infosys', 'Infosys', 'joining_confirmed', null, null, 'Power Programmer', 2026, '2026-05-10', 'community', true),
  ('demo-wipro-1', 'wipro', 'Wipro', 'joining_delayed', 'Original date was April, still waiting in August.', 18, 'Project Engineer', 2025, '2026-08-05', 'community', true),
  ('demo-wipro-2', 'wipro', 'Wipro', 'offer_revoked', 'Received revocation email after 5 months of waiting.', null, 'Project Engineer', 2025, '2026-07-12', 'community', true),
  ('demo-wipro-3', 'wipro', 'Wipro', 'joining_delayed', null, 8, 'Project Engineer', 2026, '2026-09-10', 'community', true),
  ('demo-wipro-4', 'wipro', 'Wipro', 'joining_confirmed', null, null, 'Project Engineer', 2026, '2026-06-01', 'community', true),
  ('demo-tcs-1', 'tcs', 'TCS', 'joining_confirmed', null, null, 'Assistant Systems Engineer', 2026, '2026-07-01', 'community', true),
  ('demo-tcs-2', 'tcs', 'TCS', 'joining_confirmed', null, null, 'Digital Cadre', 2026, '2026-08-20', 'community', true),
  ('demo-tcs-3', 'tcs', 'TCS', 'joining_confirmed', null, null, 'Assistant Systems Engineer', 2026, '2026-09-15', 'community', true),
  ('demo-tcs-4', 'tcs', 'TCS', 'bg_verification_pending', null, null, 'Assistant Systems Engineer', 2026, '2026-09-25', 'community', true),
  ('demo-tcs-5', 'tcs', 'TCS', 'joining_delayed', null, 4, 'Digital Cadre', 2025, '2026-05-18', 'community', true),
  ('demo-cognizant-1', 'cognizant', 'Cognizant', 'joining_delayed', 'Delayed multiple times, very poor communication.', 10, 'Programmer Analyst', 2025, '2026-08-22', 'community', true),
  ('demo-cognizant-2', 'cognizant', 'Cognizant', 'joining_delayed', null, 14, 'GenC', 2025, '2026-07-30', 'community', true),
  ('demo-cognizant-3', 'cognizant', 'Cognizant', 'joining_confirmed', null, null, 'Programmer Analyst', 2026, '2026-09-05', 'community', true),
  ('demo-deloitte-1', 'deloitte', 'Deloitte', 'joining_confirmed', null, null, 'Analyst', 2026, '2026-08-01', 'community', true),
  ('demo-deloitte-2', 'deloitte', 'Deloitte', 'joining_confirmed', null, null, 'Consultant', 2026, '2026-09-12', 'community', true),
  ('demo-deloitte-3', 'deloitte', 'Deloitte', 'bg_verification_pending', null, null, 'Analyst', 2026, '2026-09-28', 'community', true),
  ('demo-capgemini-1', 'capgemini', 'Capgemini', 'offer_revoked', 'Offer rescinded citing business restructuring.', null, 'Analyst', 2025, '2026-06-20', 'community', true),
  ('demo-capgemini-2', 'capgemini', 'Capgemini', 'joining_delayed', null, 20, 'Associate Consultant', 2025, '2026-08-10', 'community', true),
  ('demo-capgemini-3', 'capgemini', 'Capgemini', 'joining_delayed', null, 12, 'Analyst', 2026, '2026-09-18', 'community', true),
  ('demo-capgemini-4', 'capgemini', 'Capgemini', 'joining_confirmed', null, null, 'Senior Analyst', 2026, '2026-09-22', 'community', true)
on conflict (id) do nothing;

insert into public.tracked_offers
  (id, company_slug, company_name, role, offer_date, expected_joining_date, last_communication_date, current_status, notes, is_demo, created_at)
values
  ('demo-tracked-1', 'infosys', 'Infosys', 'Systems Engineer', '2026-03-15', '2026-10-01', '2026-09-20', 'bg_verification_pending', 'BG verification initiated on Sep 15. Awaiting confirmation.', true, '2026-01-01T00:00:00Z')
on conflict (id) do nothing;
