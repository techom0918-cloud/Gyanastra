// Demo seed data — clearly labelled as demonstration data, not real reports
import { OfferReport, TrackedOffer } from '@/types';

// Fixed IDs keep the database seed (supabase/seed.sql) idempotent.
export const SEED_REPORTS: OfferReport[] = [
  // --- Company: Infosys ---
  { id: 'demo-infosys-1', companySlug: 'infosys', companyName: 'Infosys', status: 'joining_confirmed', role: 'Systems Engineer', graduationYear: 2026, reportedAt: '2026-08-12', sourceType: 'community', isDemo: true },
  { id: 'demo-infosys-2', companySlug: 'infosys', companyName: 'Infosys', status: 'joining_delayed', description: 'Joining pushed from July to October. No clear communication.', delayWeeks: 12, role: 'Systems Engineer', graduationYear: 2026, reportedAt: '2026-09-01', sourceType: 'community', isDemo: true },
  { id: 'demo-infosys-3', companySlug: 'infosys', companyName: 'Infosys', status: 'joining_confirmed', role: 'Digital Specialist', graduationYear: 2026, reportedAt: '2026-07-20', sourceType: 'community', isDemo: true },
  { id: 'demo-infosys-4', companySlug: 'infosys', companyName: 'Infosys', status: 'joining_delayed', description: 'Delayed by 6 weeks, then confirmed.', delayWeeks: 6, role: 'Systems Engineer', graduationYear: 2025, reportedAt: '2026-06-15', sourceType: 'community', isDemo: true },
  { id: 'demo-infosys-5', companySlug: 'infosys', companyName: 'Infosys', status: 'bg_verification_pending', role: 'Systems Engineer', graduationYear: 2026, reportedAt: '2026-09-20', sourceType: 'community', isDemo: true },
  { id: 'demo-infosys-6', companySlug: 'infosys', companyName: 'Infosys', status: 'joining_confirmed', role: 'Power Programmer', graduationYear: 2026, reportedAt: '2026-05-10', sourceType: 'community', isDemo: true },

  // --- Company: Wipro ---
  { id: 'demo-wipro-1', companySlug: 'wipro', companyName: 'Wipro', status: 'joining_delayed', description: 'Original date was April, still waiting in August.', delayWeeks: 18, role: 'Project Engineer', graduationYear: 2025, reportedAt: '2026-08-05', sourceType: 'community', isDemo: true },
  { id: 'demo-wipro-2', companySlug: 'wipro', companyName: 'Wipro', status: 'offer_revoked', description: 'Received revocation email after 5 months of waiting.', role: 'Project Engineer', graduationYear: 2025, reportedAt: '2026-07-12', sourceType: 'community', isDemo: true },
  { id: 'demo-wipro-3', companySlug: 'wipro', companyName: 'Wipro', status: 'joining_delayed', delayWeeks: 8, role: 'Project Engineer', graduationYear: 2026, reportedAt: '2026-09-10', sourceType: 'community', isDemo: true },
  { id: 'demo-wipro-4', companySlug: 'wipro', companyName: 'Wipro', status: 'joining_confirmed', role: 'Project Engineer', graduationYear: 2026, reportedAt: '2026-06-01', sourceType: 'community', isDemo: true },

  // --- Company: TCS ---
  { id: 'demo-tcs-1', companySlug: 'tcs', companyName: 'TCS', status: 'joining_confirmed', role: 'Assistant Systems Engineer', graduationYear: 2026, reportedAt: '2026-07-01', sourceType: 'community', isDemo: true },
  { id: 'demo-tcs-2', companySlug: 'tcs', companyName: 'TCS', status: 'joining_confirmed', role: 'Digital Cadre', graduationYear: 2026, reportedAt: '2026-08-20', sourceType: 'community', isDemo: true },
  { id: 'demo-tcs-3', companySlug: 'tcs', companyName: 'TCS', status: 'joining_confirmed', role: 'Assistant Systems Engineer', graduationYear: 2026, reportedAt: '2026-09-15', sourceType: 'community', isDemo: true },
  { id: 'demo-tcs-4', companySlug: 'tcs', companyName: 'TCS', status: 'bg_verification_pending', role: 'Assistant Systems Engineer', graduationYear: 2026, reportedAt: '2026-09-25', sourceType: 'community', isDemo: true },
  { id: 'demo-tcs-5', companySlug: 'tcs', companyName: 'TCS', status: 'joining_delayed', delayWeeks: 4, role: 'Digital Cadre', graduationYear: 2025, reportedAt: '2026-05-18', sourceType: 'community', isDemo: true },

  // --- Company: Cognizant ---
  { id: 'demo-cognizant-1', companySlug: 'cognizant', companyName: 'Cognizant', status: 'joining_delayed', delayWeeks: 10, description: 'Delayed multiple times, very poor communication.', role: 'Programmer Analyst', graduationYear: 2025, reportedAt: '2026-08-22', sourceType: 'community', isDemo: true },
  { id: 'demo-cognizant-2', companySlug: 'cognizant', companyName: 'Cognizant', status: 'joining_delayed', delayWeeks: 14, role: 'GenC', graduationYear: 2025, reportedAt: '2026-07-30', sourceType: 'community', isDemo: true },
  { id: 'demo-cognizant-3', companySlug: 'cognizant', companyName: 'Cognizant', status: 'joining_confirmed', role: 'Programmer Analyst', graduationYear: 2026, reportedAt: '2026-09-05', sourceType: 'community', isDemo: true },

  // --- Company: Deloitte ---
  { id: 'demo-deloitte-1', companySlug: 'deloitte', companyName: 'Deloitte', status: 'joining_confirmed', role: 'Analyst', graduationYear: 2026, reportedAt: '2026-08-01', sourceType: 'community', isDemo: true },
  { id: 'demo-deloitte-2', companySlug: 'deloitte', companyName: 'Deloitte', status: 'joining_confirmed', role: 'Consultant', graduationYear: 2026, reportedAt: '2026-09-12', sourceType: 'community', isDemo: true },
  { id: 'demo-deloitte-3', companySlug: 'deloitte', companyName: 'Deloitte', status: 'bg_verification_pending', role: 'Analyst', graduationYear: 2026, reportedAt: '2026-09-28', sourceType: 'community', isDemo: true },

  // --- Company: Capgemini ---
  { id: 'demo-capgemini-1', companySlug: 'capgemini', companyName: 'Capgemini', status: 'offer_revoked', description: 'Offer rescinded citing business restructuring.', role: 'Analyst', graduationYear: 2025, reportedAt: '2026-06-20', sourceType: 'community', isDemo: true },
  { id: 'demo-capgemini-2', companySlug: 'capgemini', companyName: 'Capgemini', status: 'joining_delayed', delayWeeks: 20, role: 'Associate Consultant', graduationYear: 2025, reportedAt: '2026-08-10', sourceType: 'community', isDemo: true },
  { id: 'demo-capgemini-3', companySlug: 'capgemini', companyName: 'Capgemini', status: 'joining_delayed', delayWeeks: 12, role: 'Analyst', graduationYear: 2026, reportedAt: '2026-09-18', sourceType: 'community', isDemo: true },
  { id: 'demo-capgemini-4', companySlug: 'capgemini', companyName: 'Capgemini', status: 'joining_confirmed', role: 'Senior Analyst', graduationYear: 2026, reportedAt: '2026-09-22', sourceType: 'community', isDemo: true },
];

export const SEED_TRACKED_OFFERS: TrackedOffer[] = [
  {
    id: 'demo-tracked-1',
    companySlug: 'infosys',
    companyName: 'Infosys',
    role: 'Systems Engineer',
    offerDate: '2026-03-15',
    expectedJoiningDate: '2026-10-01',
    lastCommunicationDate: '2026-09-20',
    currentStatus: 'bg_verification_pending',
    notes: 'BG verification initiated on Sep 15. Awaiting confirmation.',
    alerts: [],
    isDemo: true,
  },
];
