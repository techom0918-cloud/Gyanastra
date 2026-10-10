// Rule-based 30/60/90-day action plan. Every task says why it is there and where it came from (the user's profile, an
// earlier assessment, or general practice), so nothing is presented as more specific than it is. Targets such as
// "5 applications" are labelled as suggestions, not benchmarks.
import {
  FACTOR_LABELS,
  type ActionPlanResult,
  type CareerProfile,
  type JobStabilityResult,
  type OfferRiskResult,
  type PlanPhase,
  type PlanTask,
  type TaskCategory,
} from './types';

export const PLAN_DISCLAIMER_RULES =
  'This plan was built by fixed rules from your profile and saved assessments (no AI). The numbers are suggestions to start from, not benchmarks or predictions. Adjust everything to your situation.';
export const PLAN_DISCLAIMER_AI =
  'The task wording was personalised by an AI model (Claude) from a limited, non-identifying summary of your profile. It may contain mistakes and is not a prediction. Check suggestions against your own circumstances.';

export interface PlanContext {
  profile: CareerProfile;
  offerRisk?: OfferRiskResult | null;
  jobStability?: JobStabilityResult | null;
}

type Draft = Omit<PlanTask, 'id'>;
const task = (category: TaskCategory, basis: PlanTask['basis'], title: string, why: string): Draft => ({ category, basis, title, why });

const list = (items: string[], max = 3) => items.slice(0, max).join(', ');

/** Assigns stable ids ("d30-1") and caps the number of tasks per phase. */
export function buildPhases(drafts: Record<30 | 60 | 90, { goal: string; tasks: Draft[] }>, maxTasks = 5): PlanPhase[] {
  return ([30, 60, 90] as const).map((days) => ({
    days,
    goal: drafts[days].goal,
    tasks: drafts[days].tasks.slice(0, maxTasks).map((t, i) => ({ ...t, id: `d${days}-${i + 1}` })),
  }));
}

export function generateRulesPlan(ctx: PlanContext): ActionPlanResult {
  const { profile, offerRisk, jobStability } = ctx;
  const role = profile.targetRole ?? profile.currentJobTitle;
  const roleText = role ? `"${role}"` : 'your target role';
  const growth = profile.growthSkills.length > 0 ? profile.growthSkills : [];
  const considering = profile.status === 'employed' && jobStability && jobStability.stage !== 'left';
  const left = jobStability?.stage === 'left';
  const offerOpen = offerRisk && (profile.status === 'offer_received' || profile.status === 'student' || profile.status === 'seeking' || offerRisk.level !== 'no_specific_concerns');

  const d30: Draft[] = [];
  const d60: Draft[] = [];
  const d90: Draft[] = [];

  // --- Verification / situation tasks -----------------------------------------------------------------------------
  if (offerOpen && offerRisk) {
    for (const action of offerRisk.actions.slice(0, 2)) d30.push(task('verification', 'assessment', action, 'From your offer assessment: this addresses an open question about your offer.'));
    if (offerRisk.level !== 'no_specific_concerns') {
      d30.push(task('application', 'assessment', 'Keep 3 backup applications moving (suggested starting target).', 'Your offer assessment found open questions, and backup options reduce dependence on one outcome.'));
    }
  }
  if (considering && jobStability) {
    const topConcerns = jobStability.factors.filter((f) => f.reading === 'concern').map((f) => FACTOR_LABELS[f.key].toLowerCase());
    d30.push(task('reflection', 'assessment', `Write down what specifically is wrong with ${topConcerns.length ? list(topConcerns) : 'the role'}, and what "better" would look like.`, 'Your job-stability check flagged these factors; precise problems are easier to fix or to screen for.'));
    d30.push(task('financial', 'assessment', 'Work out your monthly expenses and how many months your savings cover.', 'Runway is the biggest factor in how much flexibility you have when considering a move.'));
    d60.push(task('preparation', 'assessment', 'Have one honest conversation with your manager about the top issue, with a specific request.', 'Some concerns (workload, learning, role fit) can sometimes be improved from within; testing this informs your decision.'));
    d90.push(task('reflection', 'assessment', 'Reassess: has anything changed? Decide whether to stay, search seriously, or plan a transition.', 'A fixed checkpoint prevents drifting without a decision.'));
  }
  if (left) {
    d30.push(task('financial', 'assessment', 'Recompute your runway and set a monthly review date.', 'You have left your role, so the pace of the search should match your savings.'));
  }

  // --- Skills ---------------------------------------------------------------------------------------------------------
  if (growth.length > 0) {
    d30.push(task('skill', 'profile', `Start learning ${growth[0]} with a small, concrete practice project.`, `You listed ${growth[0]} as a skill you want to develop.`));
    if (growth[1]) d60.push(task('skill', 'profile', `Build or extend something that shows ${growth[1]}, and write a short note on what you learned.`, `You listed ${growth[1]} as a skill you want to develop.`));
    d90.push(task('skill', 'profile', `Add evidence of ${list(growth, 2)} to your resume or portfolio.`, 'Showing applied skills is more convincing than listing them.'));
  } else {
    d30.push(task('skill', 'general', `Compare ${roleText} job descriptions and note the skills that recur and that you lack.`, 'You have not listed skills to develop yet; real job descriptions are a reasonable place to start.'));
  }

  // --- Applications / preparation -------------------------------------------------------------------------------
  const locations = profile.preferredLocations.length > 0 ? ` in ${list(profile.preferredLocations)}` : '';
  const searching = profile.status === 'seeking' || left || (considering && jobStability?.stage === 'preparing') || (offerOpen && offerRisk?.level === 'needs_attention');
  d30.push(task('preparation', 'general', 'Update your resume and online profile so they reflect your latest work and skills.', 'Current materials are a prerequisite for any application or conversation.'));
  if (searching) {
    d60.push(task('application', 'general', `Apply to about 5 suitable ${roleText} roles${locations} per week (suggested starting pace; adjust to your capacity).`, 'You are actively searching; a steady cadence is easier to sustain than occasional bursts.'));
    d60.push(task('preparation', 'general', 'Practise interview questions for the role and prepare 3 stories about your work.', 'Preparation improves how you present what you already know.'));
    d90.push(task('application', 'general', 'Review which applications led to conversations and adjust your targets and materials.', 'Reviewing results keeps the search from repeating what is not working.'));
  } else {
    d60.push(task('application', 'general', `Identify 10 companies or teams${locations} that fit ${roleText} and follow their openings.`, 'Knowing where you would apply makes it quick to act if an opportunity appears.'));
    d60.push(task('preparation', 'general', 'Talk to two people working in the role or field to learn what the day-to-day is really like.', 'Firsthand accounts are more reliable than job descriptions.'));
    d90.push(task('application', 'general', 'Decide whether to apply to a few roles that stretch you, based on what you learned.', 'A deliberate next step turns research into progress.'));
  }
  if (profile.goals) d90.push(task('reflection', 'profile', 'Compare your progress with the goal you wrote down, and update your goal or this plan.', 'You set a goal in your profile; checking progress against it keeps the plan relevant.'));
  if (profile.priorities.length > 0) d90.push(task('reflection', 'profile', 'Check that your next step still reflects your top priorities.', 'You told us what matters most; moves that ignore it tend to feel worse later.'));

  const summary = left
    ? 'A plan for the next 90 days while you search after leaving your role.'
    : considering
      ? 'A plan for the next 90 days that keeps your options open while you work out what you want.'
      : profile.status === 'student' || profile.status === 'offer_received'
        ? 'A plan for the next 90 days that builds skills and keeps backups ready alongside your offer.'
        : 'A plan for the next 90 days toward your target role.';

  return {
    kind: 'action_plan',
    summary,
    phases: buildPhases({
      30: { goal: 'Get clear on your situation and start building momentum.', tasks: d30 },
      60: { goal: 'Take visible steps: practise, reach out and apply.', tasks: d60 },
      90: { goal: 'Review results and decide your next move.', tasks: d90 },
    }),
    disclaimer: PLAN_DISCLAIMER_RULES,
  };
}
