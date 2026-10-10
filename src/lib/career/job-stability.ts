// Job stability and exit planning. It never labels the person, never predicts that they will leave, and never says
// what they "should" do: it lays out the options with what each depends on, ordered by what they told us.
import {
  FACTOR_KEYS,
  FACTOR_LABELS,
  type EvidenceItem,
  type FactorReading,
  type JobStabilityInput,
  type JobStabilityResult,
  type PracticalNote,
  type StabilityOption,
} from './types';

export const JOB_STABILITY_DISCLAIMER =
  'This is a structured way to think through your situation using only what you entered. It does not predict outcomes, does not judge your decision, and is not financial, legal or career advice. You know your circumstances best.';

const reading = (rating?: number): FactorReading['reading'] => (rating === undefined ? 'unknown' : rating <= 2 ? 'concern' : rating >= 4 ? 'strength' : 'neutral');

export function assessJobStability(input: JobStabilityInput): JobStabilityResult {
  const factors: FactorReading[] = FACTOR_KEYS.map((key) => ({ key, label: FACTOR_LABELS[key], rating: input.ratings[key], reading: reading(input.ratings[key]) }));
  const concerns = factors.filter((f) => f.reading === 'concern');
  const strengths = factors.filter((f) => f.reading === 'strength');
  const unknownFactors = factors.filter((f) => f.reading === 'unknown');
  const concernKeys = new Set(concerns.map((f) => f.key));
  const fixable = concerns.length > 0 && concerns.every((f) => f.key === 'workload' || f.key === 'work_environment' || f.key === 'learning_growth' || f.key === 'role_fit');
  const runway = input.runwayMonths;
  const hasOffer = input.hasAlternativeOffer === 'yes';
  const tenure = input.tenureMonths;

  const observations: EvidenceItem[] = [];
  const unknowns: string[] = [];
  const practical: PracticalNote[] = [];

  if (concerns.length > 0) {
    observations.push({ type: 'user_statement', text: `You rated ${concerns.map((f) => f.label.toLowerCase()).join(', ')} as a concern.`, concern: true });
  }
  if (strengths.length > 0) {
    observations.push({ type: 'user_statement', text: `You rated ${strengths.map((f) => f.label.toLowerCase()).join(', ')} as a strength.` });
  }
  if (input.topPriority) observations.push({ type: 'user_statement', text: `Your top priority right now is ${FACTOR_LABELS[input.topPriority].toLowerCase()}.` });
  if (concerns.length >= 3) {
    observations.push({ type: 'inference', text: 'Several factors are weighing on you at once, so the dissatisfaction may be broader than one fixable issue.', concern: true });
  } else if (concerns.length > 0 && fixable) {
    observations.push({ type: 'inference', text: 'The factors you flagged are ones that can sometimes be improved by a conversation or a change of team, which is worth testing before deciding.' });
  }
  if (tenure !== undefined && tenure <= 12 && input.stage !== 'left') {
    observations.push({ type: 'inference', text: `At about ${tenure} month${tenure === 1 ? '' : 's'} in, you may still be forming a picture of the role. That is context, not a reason to stay or leave.` });
  }
  if (unknownFactors.length > 0) unknowns.push(`Not rated: ${unknownFactors.map((f) => f.label.toLowerCase()).join(', ')}.`);

  // --- practical considerations -----------------------------------------------------------------------------------
  if (runway === undefined) {
    unknowns.push('How many months of expenses your savings would cover.');
  } else if (runway < 3 && !hasOffer) {
    practical.push({ topic: 'Savings', note: `Savings that cover about ${runway} month${runway === 1 ? '' : 's'} leave little room for a gap between jobs. Many people prefer to build a larger buffer, or to have a confirmed offer, before leaving.`, concern: true });
  } else if (runway >= 6) {
    practical.push({ topic: 'Savings', note: `About ${runway} months of savings gives you more room to be selective, if those figures are accurate.` });
  } else {
    practical.push({ topic: 'Savings', note: `About ${runway} months of savings is a moderate buffer. How comfortable that is depends on your expenses and how long searches take in your field.` });
  }

  if (input.stage !== 'left') {
    if (input.noticePeriodDays === undefined) {
      unknowns.push('Your notice period and whether it can be shortened or bought out.');
    } else if (input.noticePeriodDays >= 60) {
      practical.push({ topic: 'Notice period', note: `A ${input.noticePeriodDays}-day notice period affects when you could start elsewhere. Check your contract for buy-out options, and tell prospective employers early.`, concern: true });
    } else {
      practical.push({ topic: 'Notice period', note: `A ${input.noticePeriodDays}-day notice period is worth lining up with any prospective start date.` });
    }
    if (input.hasAlternativeOffer === 'yes') {
      practical.push({ topic: 'Alternative offer', note: 'Before resigning, confirm the new offer is in writing, with the role, pay and start date you expect, and that any checks are complete.' });
    } else if (input.hasAlternativeOffer === 'no') {
      practical.push({ topic: 'Alternative offer', note: 'With no confirmed alternative yet, searching while you are still employed keeps your income and your options open.' });
    } else {
      unknowns.push('Whether you have a confirmed alternative offer.');
    }
    if (tenure !== undefined && tenure < 12) {
      practical.push({ topic: 'Your agreement', note: 'Check your offer letter or contract for any bond, repayment or relieving-letter conditions that apply if you leave early.' });
    }
  }
  if (input.responsibilities === 'significant') {
    practical.push({ topic: 'Responsibilities', note: 'With significant financial responsibilities, income continuity usually deserves extra weight in the timing of any move.', concern: true });
  } else if (input.responsibilities === 'unknown') {
    unknowns.push('Any financial responsibilities that affect how much risk you can take on.');
  }

  // --- options -------------------------------------------------------------------------------------------------------
  const options: StabilityOption[] = [];
  // With no ratings at all there is no evidence for or against staying, so no option is favoured on that basis.
  const anyRated = unknownFactors.length < factors.length;
  const thin = runway !== undefined && runway < 3 && !hasOffer;

  if (input.stage === 'left') {
    const gap = input.monthsSinceLeaving;
    options.push({
      id: 'stabilise_and_search',
      title: 'Stabilise finances and search with a routine',
      emphasis: 'worth_exploring_first',
      why: gap !== undefined ? `You told us you left about ${gap} month${gap === 1 ? '' : 's'} ago, so a steady search routine and a clear view of your runway matter most.` : 'Having left, a steady search routine and a clear view of your runway matter most.',
      considerations: ['Track your runway monthly so the search pace matches your savings.', 'Be ready to explain the move briefly and positively; focus on what you learned and what you want next.', 'Short-term or contract work can extend your runway while you search, if it suits your goals.'],
      firstSteps: ['Write down monthly expenses and recompute your runway.', 'Update your resume and a short, honest explanation of why you left.', 'Set a weekly target for applications and conversations.'],
    });
    options.push({
      id: 'prepare_transition',
      title: 'Be deliberate about what to look for next',
      emphasis: 'also_reasonable',
      why: concerns.length > 0 ? `You flagged ${concerns.map((f) => f.label.toLowerCase()).join(', ')}, which can guide what you screen for next.` : 'Naming what mattered most in the last role helps you screen the next one.',
      considerations: ['Ask about the factors that mattered most to you during interviews, not only after joining.'],
      firstSteps: ['List your top three must-haves and top three dealbreakers.'],
    });
    return finish(input, factors, observations, options, practical, unknowns);
  }

  const searchScore = (concerns.length >= 3 ? 2 : concerns.length >= 1 && !fixable ? 2 : concerns.length > 0 ? 1 : 0) + (hasOffer ? 1 : 0) + (input.stage === 'preparing' ? 1 : 0);
  const stayScore = (fixable ? 2 : 0) + (concerns.length === 0 && anyRated ? 2 : 0) + (anyRated && tenure !== undefined && tenure <= 12 ? 1 : 0) + (thin ? 1 : 0) - (concerns.length >= 3 ? 2 : 0);
  const transitionScore = (input.stage === 'preparing' ? 2 : 0) + (hasOffer ? 2 : 0) + (runway !== undefined && runway >= 3 ? 1 : 0) - (thin ? 2 : 0);

  const rank = (score: number, best: number): StabilityOption['emphasis'] => (best <= 0 ? 'also_reasonable' : score <= 0 ? 'less_suited_right_now' : score >= best ? 'worth_exploring_first' : 'also_reasonable');
  const best = Math.max(stayScore, searchScore, transitionScore);

  options.push({
    id: 'stay_and_improve',
    title: 'Stay and try to improve the situation',
    emphasis: rank(stayScore, best),
    why: fixable ? 'The factors you flagged are ones that can sometimes be improved from within.' : concerns.length === 0 ? 'You did not flag major concerns, so there may be little pushing you out.' : 'Staying and improving is always an option, though your ratings suggest the issues may run deeper.',
    considerations: ['Staying keeps your income and gives you time to learn more.', 'Improvement depends on whether your manager and team can actually change things.', ...(concernKeys.has('compensation') ? ['Compensation changes usually need evidence and timing; a market-pay check helps.'] : [])],
    firstSteps: ['Write down the one or two changes that would make the biggest difference.', 'Raise them with your manager with a specific request and a time to revisit.', 'Set a date (for example 8 to 12 weeks) to reassess honestly.'],
  });
  options.push({
    id: 'search_while_employed',
    title: 'Search quietly while employed',
    emphasis: rank(searchScore, best),
    why: hasOffer ? 'You already have an alternative offer, so comparing it carefully is the natural next step.' : concerns.length > 0 ? 'Looking around keeps your income steady while you learn what else is available.' : 'It keeps options open without committing to a change.',
    considerations: ['It protects your income, but takes time and energy alongside your current work.', 'Be careful not to use employer devices or time for the search, and check any confidentiality terms.', 'You can still decide to stay if nothing better appears.'],
    firstSteps: ['Update your resume and profile with your recent work.', 'Set a modest weekly goal for applications or conversations.', 'Decide in advance what an offer must include for you to move.'],
  });
  options.push({
    id: 'prepare_transition',
    title: 'Prepare a planned transition',
    emphasis: rank(transitionScore, best),
    why: thin ? 'With a thin savings buffer and no confirmed offer, leaving first carries more financial risk, so this is less suited for now.' : input.stage === 'preparing' ? 'You told us you are preparing to leave, so the details of timing and notice matter most.' : 'Consider this once you have a confirmed offer or a sufficient buffer.',
    considerations: ['Align your resignation with a written offer and a realistic start date.', 'Plan a handover and keep the relationship professional; references matter later.', 'Know your notice period, bond conditions and final-payment terms.'],
    firstSteps: ['Confirm the new offer details in writing.', 'Check your notice period and any contract conditions.', 'Prepare a short, courteous resignation and a handover outline.'],
  });

  // Surface the most relevant option first, without hiding the others.
  const order: Record<StabilityOption['emphasis'], number> = { worth_exploring_first: 0, also_reasonable: 1, less_suited_right_now: 2 };
  options.sort((a, b) => order[a.emphasis] - order[b.emphasis]);
  return finish(input, factors, observations, options, practical, unknowns);
}

function finish(input: JobStabilityInput, factors: FactorReading[], observations: EvidenceItem[], options: StabilityOption[], practical: PracticalNote[], unknowns: string[]): JobStabilityResult {
  const headline =
    input.stage === 'left'
      ? 'You have left your role. Here is a way to organise the next steps.'
      : input.stage === 'preparing'
        ? 'You are preparing to leave. These are the points that usually matter for timing and risk.'
        : 'You are weighing a change. Here are balanced options and what each depends on.';
  return { kind: 'job_stability', stage: input.stage, headline, factors, observations, options, practical, unknowns, disclaimer: JOB_STABILITY_DISCLAIMER };
}
