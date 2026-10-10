/**
 * AI Backup Career Planner
 * Uses mock data when no API key is configured.
 * Set OPENAI_API_KEY in .env.local to enable live AI.
 */

import { BackupPlanInput, GeneratedPlan } from '@/types';

const DISCLAIMER = 'This plan is AI-generated guidance based on your inputs. It does not guarantee job placement or predict offer outcomes. Verify all suggestions independently.';

export async function generateBackupPlan(input: BackupPlanInput): Promise<GeneratedPlan> {
  // Always use mock for hackathon demo (no API key available)
  return generateMockPlan(input);
}

function generateMockPlan(input: BackupPlanInput): GeneratedPlan {
  const statusScenarios: Record<string, string> = {
    offer_received: 'Your offer is received but not yet confirmed. Stay prepared while awaiting next steps.',
    bg_verification_pending: 'Background verification is in progress. Use this time productively.',
    joining_confirmed: 'Your joining is confirmed. Focus on onboarding preparation and skill-building.',
    joining_delayed: 'Your joining has been delayed. Actively pursue backup options while monitoring your offer.',
    offer_revoked: 'Your offer has been revoked. Prioritise immediate job search and skill development.',
  };

  const urgency = ['offer_revoked', 'joining_delayed'].includes(input.currentOfferStatus);
  const skills = input.skills.slice(0, 5);

  return {
    scenario: statusScenarios[input.currentOfferStatus] || 'Prepare for multiple outcomes.',
    immediateActions: [
      urgency ? 'Update your resume and portfolio immediately' : 'Keep your resume current and ready to send',
      `Identify 10-15 companies hiring for ${input.preferredRole} roles${input.locationPreferences.length > 0 ? ` in ${input.locationPreferences.join(', ')}` : ''}`,
      urgency ? 'Begin applying to backup positions this week' : 'Shortlist backup companies as a precaution',
      'Reach out to your college placement cell for updates and alternative openings',
      `Strengthen your ${skills[0] || 'core'} skills with a focused project or certification`,
      'Connect with alumni working in your target sector on LinkedIn',
    ],
    weeklyGoals: [
      { week: 1, goals: ['Update resume and LinkedIn profile', `Apply to 5 ${input.preferredRole} positions`, 'Start one skill-building project'] },
      { week: 2, goals: ['Follow up on Week 1 applications', `Complete an online module on ${skills[1] || skills[0] || 'a relevant skill'}`, 'Practice 2 mock interviews'] },
      { week: 3, goals: ['Apply to 5 more positions', 'Complete your skill project or case study', 'Network with 3 professionals in your target domain'] },
      { week: 4, goals: ['Review and refine your strategy', 'Follow up on all pending applications', 'Prepare for upcoming interviews with company-specific research'] },
    ],
    skillsToImprove: skills.map((s) => ({
      skill: s,
      reason: `${s} is relevant for ${input.preferredRole} roles and strengthens your candidacy`,
      resources: [`Free courses on Coursera/NPTEL for ${s}`, `Build a small project demonstrating ${s}`, `Join communities/forums focused on ${s}`],
    })),
    applicationStrategy: [
      `Target mid-sized companies and startups hiring for ${input.preferredRole} — they often have faster hiring cycles`,
      'Use Naukri, LinkedIn Jobs, and Internshala (for fresher roles) simultaneously',
      'Tailor each application with a role-specific cover letter',
      'Leverage college placement cell for off-campus drives',
      input.currentOfferStatus === 'offer_revoked'
        ? 'Consider contract or internship-to-full-time roles as stepping stones'
        : 'Keep your current offer as primary while building backup options',
    ],
    interviewPrep: [
      `Prepare STAR-method answers for behavioural questions relevant to ${input.preferredRole}`,
      `Review core concepts in ${skills.slice(0, 3).join(', ')}`,
      'Practice coding/case rounds on platforms like LeetCode, InterviewBit, or PrepInsta',
      'Prepare a 2-minute self-introduction tailored to your target role',
      'Research each company before interviews — recent news, products, culture',
    ],
    disclaimer: DISCLAIMER,
  };
}
