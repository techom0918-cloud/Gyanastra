# Security and privacy

What Aagey does to protect data and limit abuse, and what it does **not** yet do.
Last reviewed: 2026-10-10. This is an engineering summary, not a guarantee that the app is secure.

## Architecture

- All database access runs on the server (Next.js route handlers) with the Supabase **secret / service-role key**
  (`SUPABASE_SECRET_KEY`). The key is read only from server environment variables. It is never prefixed
  `NEXT_PUBLIC_`, never sent to the browser and never included in responses or logs.
- Both tables have **Row Level Security enabled with no policies**, so the public anon key cannot read or write
  them directly. `service_role` has explicit table grants (`20261010000001_grant_service_role.sql`). This review
  made no changes to RLS or grants.
- Queries go through supabase-js / PostgREST with parameterised filters. There is no raw SQL in the app, so no SQL
  injection surface.
- React escapes all rendered text. There is no `dangerouslySetInnerHTML`, `eval` or user-controlled link.

## Endpoints

| Route | Access | Protections |
|---|---|---|
| `GET /api/reports`, `/api/companies`, `/api/companies/[slug]`, `/api/dashboard` | Public, read-only | Generic error bodies; slug validated (`[a-z0-9-]`, ≤ 200) |
| `POST /api/reports` | Anonymous (intended) | 16 KB body cap; Zod schema (unknown fields such as `isDemo`, `sourceType` and `id` are stripped; server sets them); personal-data rejection; per-submitter rate limit and duplicate check (below) |
| `GET/POST/PATCH /api/tracker` | Anonymous, per browser | Offers are private to the browser that created them (below); demo offers are read-only; 16 KB cap; personal-data rejection in notes/role |
| `POST /api/classify-report` | Anonymous | 16 KB cap; 5–1000 characters; local keyword classifier (no external call) |
| `POST /api/backup-plan` | Anonymous | 16 KB cap; Zod schema; personal-data rejection; AI calls capped per client; provider key server-only; template fallback |

Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin` and a restrictive `Permissions-Policy`. `X-Powered-By` is off.

## Abuse controls on report submission

- **Identity without tracking:** a submitter is `HMAC-SHA256(secret, "<UTC day>|<client IP>")`, truncated to
  32 hex characters and stored in `offer_reports.submitter_hash`. The IP itself is never stored, and hashes from
  different days can't be linked. The secret is `AAGEY_RATE_LIMIT_SECRET`, or else is derived one-way from
  `SUPABASE_SECRET_KEY`.
- **Limits** (`src/lib/abuse/submissions.ts`): 3 reports per 10 minutes, 10 per UTC day, and no repeat of the same
  outcome for the same company on the same day (409). Rate-limited responses are 429 with `Retry-After`.
- **Global across serverless instances**, because the counts come from the database. This needs migration
  `20261010000003_add_report_submitter_hash.sql`. **Until it is applied**, the app keeps working with a
  per-instance in-memory fallback, which is *not* a reliable global limit.
- **Score-side defence:** whatever gets stored, community reports for one company on one day share at most 3 units
  of weight in the reliability score. A burst of posts can't swamp a company's history (see Methodology).
- **Client IP:** the first `x-forwarded-for` entry, which Vercel sets. Behind a different proxy this must be revisited.

## Tracked offers (privacy fix)

Before this change, `GET /api/tracker` returned **every visitor's** tracked offers, including notes and dates. It also
exposed their ids, which were enough to edit anyone's offer through `PATCH`. Now:
- New offer ids are random UUIDs. The id acts as a private key stored only in the creating browser's
  `localStorage`, and sent back in the `x-aagey-offer-ids` header (at most 20, validated).
- `GET` returns demo offers plus the offers whose ids the caller holds. `PATCH` can't modify demo offers.
- **Limitation:** there are no accounts. Anyone who obtains an id (e.g. from the same browser) can view and edit
  that offer. Clearing browser storage loses access. Offers created before this change by other people are no
  longer listed to anyone.

## Personal data

- Collected: anonymous report fields (company, status, optional role, graduation year, delay, short description) and
  tracker fields. No accounts, names, emails or documents.
- Rejected at the API and in imports (`src/lib/privacy.ts`): email addresses, 10+ digit numbers (phone, Aadhaar),
  PAN-like codes, roll/registration numbers with an explicit label, and university seat numbers (e.g. 1RV20CS001).
  Requests containing them get 400 and nothing is stored. **Names can't be detected reliably.** The forms ask users
  not to include them.
- Submitter hashes are only useful on their own UTC day. Optional cleanup SQL is in the migration file (not run
  automatically).

## AI provider (Backup Planner)

- Provider key: `ANTHROPIC_API_KEY`, server-only. Without it the planner uses the rule-based template, and the
  response says `isAIGenerated: false`.
- Sent to the provider: skills, degree, preferred role, locations, offer status, expected joining date and the
  optional free-text context (after the personal-data check). **Not sent:** the company name.
- Output is schema-validated and length-limited. The disclaimer is set by the server. The model is told it has no
  company information and must not invent facts. Student text is fenced as data to resist prompt injection.
- Timeout 20 s with one retry. Any failure, refusal or malformed output falls back to the template.
- Cost control: at most 5 AI plans per client per 10 minutes **per server instance** (best effort). For a hard cap,
  set a spend limit in the Anthropic console.

## Known gaps and recommendations

1. Apply migration `20261010000003` so rate limits are global (manual step).
2. No Content-Security-Policy yet. Next.js inline scripts need nonce support; add a CSP with nonces as a follow-up.
3. No CAPTCHA or proof-of-work. A determined attacker rotating IPs can still submit reports; the daily score cap
   limits their effect, but consider a CAPTCHA (e.g. Cloudflare Turnstile) if abuse appears.
4. The AI per-client cap is per instance. A global limiter needs shared storage (e.g. a Supabase table or a hosted
   key-value store).
5. Tracker access relies on unguessable ids rather than accounts.
6. `GET /api/reports` publishes all report descriptions by design. Moderation of free text is manual.
7. Dashboard totals count demo and real reports together (labelled "Demo data"). Only reliability scores separate them.
