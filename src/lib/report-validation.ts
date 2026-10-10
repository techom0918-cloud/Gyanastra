// Client-side checks for the report form. They mirror the server's schema (lib/validation/schemas.ts) and personal-data
// rules (lib/privacy.ts) so mistakes are caught inline; the server remains the authority and re-checks everything.
import { findPersonalData } from '@/lib/privacy';
import { OfferStatus } from '@/types';

export interface ReportFormValues {
  companyName: string;
  status: OfferStatus;
  description: string;
  role: string;
  graduationYear: string;
  delayWeeks: string;
}

export type ReportFormErrors = Partial<Record<'companyName' | 'description' | 'role' | 'graduationYear' | 'delayWeeks', string>>;

const PERSONAL_DATA = 'This looks like it contains an email, phone number or ID number. Please remove personal details.';

export function validateReport(values: ReportFormValues): ReportFormErrors {
  const errors: ReportFormErrors = {};

  const company = values.companyName.trim();
  if (company.length < 2) errors.companyName = 'Enter the company name (at least 2 characters).';
  else if (company.length > 200) errors.companyName = 'Company name is too long (200 characters at most).';
  else if (findPersonalData(company).length > 0) errors.companyName = PERSONAL_DATA;

  if (values.description.length > 1000) errors.description = 'Keep the description under 1000 characters.';
  else if (findPersonalData(values.description).length > 0) errors.description = PERSONAL_DATA;

  if (values.role.length > 200) errors.role = 'Role is too long (200 characters at most).';
  else if (findPersonalData(values.role).length > 0) errors.role = PERSONAL_DATA;

  if (values.graduationYear.trim() !== '') {
    const year = Number(values.graduationYear);
    if (!Number.isInteger(year) || year < 2015 || year > 2030) errors.graduationYear = 'Enter a year between 2015 and 2030.';
  }

  if (values.delayWeeks.trim() !== '') {
    const weeks = Number(values.delayWeeks);
    if (!Number.isFinite(weeks) || weeks < 0 || weeks > 200) errors.delayWeeks = 'Enter a number of weeks between 0 and 200.';
  }

  return errors;
}

/** Maps an API 400 response (`details`) back onto form fields. */
export function mapServerErrors(details: unknown): ReportFormErrors {
  const out: ReportFormErrors = {};
  if (typeof details !== 'object' || details === null) return out;
  const map: Record<string, keyof ReportFormErrors> = {
    companyName: 'companyName',
    description: 'description',
    role: 'role',
    graduationYear: 'graduationYear',
    delayWeeks: 'delayWeeks',
  };
  for (const [key, value] of Object.entries(details)) {
    const field = map[key];
    if (field && Array.isArray(value) && typeof value[0] === 'string') out[field] = value[0];
  }
  return out;
}

/** Friendly wording for the abuse-control responses of POST /api/reports. */
export function describeSubmitFailure(status: number, retryAfter: string | null, fallback?: string): string {
  if (status === 409) return 'You have already reported this outcome for this company today. Duplicate reports are not counted.';
  if (status === 429) {
    const seconds = Number(retryAfter);
    const wait = Number.isFinite(seconds) && seconds > 0 ? (seconds >= 3600 ? 'a few hours' : `${Math.max(1, Math.ceil(seconds / 60))} minute(s)`) : 'a while';
    return `You have submitted several reports recently. Please wait ${wait} and try again.`;
  }
  if (status === 413) return 'That report is too large. Shorten the description and try again.';
  return fallback || 'We could not submit your report. Please try again.';
}
