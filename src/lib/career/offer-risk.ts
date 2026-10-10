// Personalised offer assessment. This is deliberately NOT a probability and NOT the company reliability score:
//  - the level comes from this user's own offer signals (written offer, confirmed date, recent contact, stage);
//  - community data about the company is shown as context only, can add a note of caution, and can never lower the
//    level of concern; demo data and thin data are never used;
//  - every statement is tagged as a reported fact, the user's own statement, or our inference.
import type { Company } from '@/types';
import { OFFER_STATUS_LABELS } from '@/types';
import type { EvidenceItem, OfferCompanyContext, OfferConcernLevel, OfferRiskInput, OfferRiskResult } from './types';

export const OFFER_RISK_DISCLAIMER =
  'This is a checklist-style assessment from what you entered, not a prediction. It cannot tell you whether a particular offer will be honoured, and community reports about a company are self-reported and unverified.';

const DAY = 86_400_000;
const daysBetween = (fromIso: string, to: Date) => Math.floor((to.getTime() - Date.parse(`${fromIso}T00:00:00Z`)) / DAY);

interface Collector {
  evidence: EvidenceItem[];
  unknowns: string[];
  verify: string[];
  actions: string[];
  weight: number;
  /** How many of the offer-specific signals we have no answer for. */
  unanswered: number;
}

function companyContext(company: Company | null, requestedName?: string): OfferCompanyContext | null {
  if (!requestedName) return null;
  if (!company) {
    return {
      matched: false,
      usedAsContext: false,
      summary: `There are no community reports for "${requestedName}" in Aagey yet, so there is no company-level context. That is a gap in the data, not a sign about the company.`,
    };
  }
  const ri = company.reliabilityIndicator;
  if (ri.basis !== 'real') {
    return {
      matched: true,
      companyName: company.name,
      usedAsContext: false,
      summary:
        ri.basis === 'demo'
          ? `Only demonstration data exists for ${company.name}. It is sample data, not real reports, so it is not used here.`
          : `Aagey has no usable reports for ${company.name} yet.`,
    };
  }
  if (ri.scoredOutcomes < 3 || ri.confidence === 'insufficient' || ri.confidence === 'low') {
    return {
      matched: true,
      companyName: company.name,
      usedAsContext: false,
      summary: `${company.name} has only ${ri.scoredOutcomes} final community-reported outcome${ri.scoredOutcomes === 1 ? '' : 's'}. That is too little to say anything meaningful, so it is not used here.`,
    };
  }
  return {
    matched: true,
    companyName: company.name,
    usedAsContext: true,
    summary: `Community reports for ${company.name}: ${ri.scoredOutcomes} final outcomes (${ri.outcomes.confirmed} joined, ${ri.outcomes.delayed} delayed, ${ri.outcomes.revoked} revoked), summarised as "${ri.label}" with ${ri.confidence} confidence. These are self-reported and unverified, describe other people's offers, and say nothing certain about yours.`,
  };
}

export function assessOfferRisk(input: OfferRiskInput, options: { company?: Company | null; now?: Date } = {}): OfferRiskResult {
  const now = options.now ?? new Date();
  const c: Collector = { evidence: [], unknowns: [], verify: [], actions: [], weight: 0, unanswered: 0 };
  const statement = (text: string, concern = false, weight = 0) => {
    c.evidence.push({ type: 'user_statement', text, concern: concern || undefined });
    c.weight += weight;
  };
  const inference = (text: string, weight = 1) => {
    c.evidence.push({ type: 'inference', text, concern: true });
    c.weight += weight;
  };

  statement(`You describe the offer's current stage as "${OFFER_STATUS_LABELS[input.offerStage]}".`);

  let revoked = false;
  switch (input.offerStage) {
    case 'offer_revoked':
      revoked = true;
      statement('You report that the offer has been withdrawn.', true, 3);
      c.actions.push('Ask the employer for the reason and any next steps in writing, and keep a copy of every message.');
      c.actions.push('Review your offer letter for any terms about withdrawal; seek advice from your placement office if needed.');
      break;
    case 'joining_delayed':
      statement('You report that your joining has been delayed.', true, 2);
      c.verify.push('A new joining date, confirmed in writing by the employer.');
      break;
    case 'bg_verification_pending':
      c.verify.push('What the background verification needs from you and when it should complete.');
      break;
    case 'joining_confirmed':
      statement('You report that your joining is confirmed.');
      break;
    case 'offer_received':
      break;
  }

  if (input.hasWrittenOffer === 'no') {
    statement('You do not have a written offer letter.', true, 2);
    c.verify.push('A written offer letter stating role, joining date and compensation.');
  } else if (input.hasWrittenOffer === 'yes') {
    statement('You have a written offer letter.');
  } else {
    c.unanswered += 1;
    c.unknowns.push('Whether you hold a written offer letter.');
  }

  const joining = input.expectedJoiningDate;
  const untilJoining = joining ? -daysBetween(joining, now) : undefined;
  if (input.joiningDateConfirmed === 'no') {
    const soon = untilJoining !== undefined && untilJoining <= 30;
    statement('The joining date has not been confirmed in writing.', true, soon ? 2 : 1);
    c.verify.push('A confirmed joining date and onboarding instructions in writing.');
  } else if (input.joiningDateConfirmed === 'yes') {
    statement('The joining date has been confirmed in writing.');
  } else {
    c.unanswered += 1;
    c.unknowns.push('Whether the joining date has been confirmed in writing.');
  }

  if (joining && untilJoining !== undefined && untilJoining < 0 && input.offerStage !== 'joining_confirmed') {
    inference(`The expected joining date (${joining}) has already passed but the stage is not "joining confirmed".`);
    c.verify.push('The current joining date and whether your offer is still active.');
  }

  if (input.recruiterResponsive === 'no') {
    statement('The recruiter or HR contact has not been responsive.', true, 1);
    c.actions.push('Send a short, polite follow-up email asking for a status update and keep a record of it.');
  } else if (input.recruiterResponsive === 'yes') {
    statement('The recruiter or HR contact is responsive.');
  } else {
    c.unanswered += 1;
    c.unknowns.push('How responsive the recruiter or HR contact has been.');
  }

  if (input.lastCommunicationDate) {
    const silent = daysBetween(input.lastCommunicationDate, now);
    if (silent < 0) {
      c.unknowns.push('The last-contact date is in the future, so it was ignored.');
    } else if (silent > 60) {
      inference(`It has been ${silent} days since the last contact you recorded.`, 2);
      c.actions.push('Reach out now to confirm the offer is active and ask for the next steps.');
    } else if (silent > 30) {
      inference(`It has been ${silent} days since the last contact you recorded.`, 1);
      c.actions.push('Send a brief check-in to the recruiter and note the reply date.');
    } else {
      statement(`Your last recorded contact was ${silent} day${silent === 1 ? '' : 's'} ago.`);
    }
  } else {
    c.unknowns.push('When you last heard from the employer.');
  }

  if (input.hasBackup === 'no') {
    statement('You do not currently have backup applications in progress.');
    c.actions.push('Keep a few backup applications moving; it protects you whatever happens with this offer.');
  } else if (input.hasBackup === 'unknown') {
    c.unknowns.push('Whether you have backup applications in progress.');
  } else {
    statement('You have backup applications in progress.');
  }

  const company = companyContext(options.company ?? null, input.companyName);
  if (company?.usedAsContext && options.company) {
    const ri = options.company.reliabilityIndicator;
    c.evidence.push({ type: 'reported_fact', text: company.summary, concern: ri.label === 'Caution Advised' || undefined });
    // Caution can add to the level; positive community data never subtracts from it.
    if (ri.label === 'Caution Advised') c.weight += 1;
  } else if (company) {
    c.evidence.push({ type: 'reported_fact', text: company.summary });
  }

  if (c.verify.length === 0) c.verify.push('That the offer letter, joining date and role match what you were told verbally.');
  if (c.actions.length === 0) c.actions.push('Keep the offer letter and key emails in one place, and re-check the joining details a few weeks before the date.');

  let level: OfferConcernLevel;
  let headline: string;
  if (revoked || c.weight >= 3) {
    level = 'needs_attention';
    headline = revoked ? 'You reported the offer was withdrawn. Focus on written clarity and your backup options.' : 'Several signals in what you shared deserve prompt attention.';
  } else if (c.weight >= 1) {
    level = 'some_open_questions';
    headline = 'A few things are unconfirmed. Clarifying them in writing would reduce the uncertainty.';
  } else if (c.unanswered >= 2) {
    level = 'insufficient_information';
    headline = 'There is not enough information to say much yet. Answering the open questions below would help.';
  } else {
    level = 'no_specific_concerns';
    headline = 'Nothing in what you shared stands out. Keep confirming key details in writing.';
  }

  return {
    kind: 'offer_risk',
    level,
    headline,
    evidence: c.evidence,
    unknowns: c.unknowns,
    verify: [...new Set(c.verify)],
    actions: [...new Set(c.actions)],
    company,
    disclaimer: OFFER_RISK_DISCLAIMER,
  };
}
