// Detects personal identifiers in free text so they are rejected before storage (data minimisation).
// Used by the report and tracker APIs and by the import pipeline. Pattern-based: it catches common
// identifiers (emails, phone/Aadhaar-length numbers, PAN, roll/registration numbers, VTU-style USNs),
// not names — the forms tell users not to include names, and Methodology documents this limit.

export interface PersonalDataMatch {
  kind: 'email' | 'phone' | 'pan' | 'student_id';
  message: string;
}

const PATTERNS: { kind: PersonalDataMatch['kind']; pattern: RegExp; message: string }[] = [
  { kind: 'email', pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, message: 'contains an email address; remove personal data' },
  // 10+ digits, optionally separated by spaces, dots or dashes (phone numbers, Aadhaar numbers).
  { kind: 'phone', pattern: /\+?\d(?:[\s.-]?\d){9,}/, message: 'contains a phone number; remove personal data' },
  { kind: 'pan', pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/, message: 'contains a PAN-like identifier; remove personal data' },
  {
    kind: 'student_id',
    // Needs an explicit marker ("roll no", "reg. number", "USN", "PRN", "student id") so years like
    // "registration 2026 batch" are not flagged.
    pattern:
      /\b(?:(?:roll|enrol(?:l)?ment|registration|reg|admission)\.?\s*(?:no\.?|number|num|#)|usn|prn|student\s*id)\s*(?:is\s*)?[:#.-]?\s*(?=[A-Z0-9/-]*\d)[A-Z0-9/-]{4,}/i,
    message: 'contains a roll/registration number; remove personal data',
  },
  // University seat numbers such as 1RV20CS001.
  { kind: 'student_id', pattern: /\b\d[A-Z]{2}\d{2}[A-Z]{2,3}\d{3}\b/i, message: 'contains a roll/registration number; remove personal data' },
];

/** All distinct kinds of personal data found in `text` (first match per kind). */
export function findPersonalData(text: string, options: { allowPhoneLikeNumbers?: boolean } = {}): PersonalDataMatch[] {
  const found: PersonalDataMatch[] = [];
  for (const { kind, pattern, message } of PATTERNS) {
    if (kind === 'phone' && options.allowPhoneLikeNumbers) continue;
    if (found.some((f) => f.kind === kind)) continue;
    if (pattern.test(text)) found.push({ kind, message });
  }
  return found;
}

/** Field-keyed errors for every listed text field that contains personal data. */
export function personalDataErrors(fields: Record<string, string | undefined>): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const matches = findPersonalData(value);
    if (matches.length > 0) errors[field] = matches.map((m) => m.message);
  }
  return errors;
}
