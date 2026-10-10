# Aagey AI

**Campus Placement Offer Decision Support Platform**

> Code2Career National AI Hackathon 2026 — PS4: Open Innovation

---

## Problem

Every year, thousands of students receive campus placement offers but face delayed joining dates, unclear timelines, or even offer revocations. They stop applying elsewhere and lose valuable preparation time — with no way to gauge what is likely to happen.

## Solution

Aagey AI is a three-module platform that brings transparency to campus placement outcomes:

| Module | What It Does |
|--------|-------------|
| **Offer Reliability Tracker** | Community-reported offer outcomes with transparent reliability scoring |
| **AI Backup Career Planner** | Personalised backup career plans tailored to your skills and situation |
| **Offer Status Watchdog** | Track your own offer, compare with community data, get rule-based alerts |

## Key Features

- **Transparent reliability indicator** — documented formula with recency weighting, revocation penalties, and small-sample damping. No black-box scores.
- **AI text classifier** — keyword-based NLP auto-detects offer status from free-text descriptions
- **Structured backup plans** — immediate actions, 4-week roadmap, skill recommendations with resources
- **Community alerts** — rule-based alerts for revocation trends, delay patterns, and overdue joining dates
- **Privacy-first** — no personal identifiers, offer letters, or confidential communications stored
- **Honest limitations** — every score shows confidence level, sample size, and methodology

## Tech Stack

- **Framework:** Next.js 16.4 with App Router & TypeScript
- **Styling:** Tailwind CSS 4
- **Validation:** Zod
- **Icons:** Lucide React
- **Data:** Supabase (PostgreSQL) via `@supabase/supabase-js`, with an in-memory demo fallback when no database is configured
- **Tests:** Vitest
- **AI:** Backup Planner uses Claude (`@anthropic-ai/sdk`) when `ANTHROPIC_API_KEY` is set; otherwise a rule-based template (each plan says which)

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production build
npm run build
npm start
```

The app runs at `http://localhost:3000`. Without database credentials it uses the in-memory demo store (data is lost on restart).

## Database Setup (Supabase)

1. Create a Supabase project.
2. In the Supabase **SQL Editor**, run each file in `supabase/migrations/` in filename order.
   They only create tables, indexes, columns, grants and RLS settings if they don't already exist — they never drop or rewrite data.
   (With the Supabase CLI linked to the project, `supabase db push` applies the same file.)
3. Optional: run `supabase/seed.sql` to load the 25 demo reports and 1 demo tracked offer.
   Every seeded row has `is_demo = true` and is labelled "Demo" in the UI. Re-running it skips rows that already exist.
4. Copy `.env.example` to `.env.local` and set `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
   (the secret / service-role key — server-only; never prefix it with `NEXT_PUBLIC_`).
   Set `AAGEY_STORAGE=supabase` to make the app return `503` instead of falling back to memory if credentials go missing.
5. Restart `npm run dev`. API responses carry an `x-aagey-storage: supabase | memory` header showing the active backend.

## Testing

```bash
npm run lint
npm run typecheck
npm test                  # unit + API tests; no database needed
npm run test:integration  # live Supabase tests; needs SUPABASE_URL, SUPABASE_SECRET_KEY and AAGEY_DB_TEST=1
```

Integration tests insert rows tagged `[aagey-integration-test]` and delete only the rows they created.

## Importing Documented Outcomes

`npm run import:reports -- <file.csv|file.json>` validates and dry-runs an import of documented offer outcomes;
`--commit` inserts after a typed confirmation. See [docs/data-import.md](docs/data-import.md) for the record format,
provenance and verification rules, and the review workflow. Researched sources (none imported) are in
[docs/data-sources.md](docs/data-sources.md).

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Landing page
│   ├── dashboard/page.tsx        # Overview dashboard
│   ├── companies/page.tsx        # Company explorer
│   ├── companies/[slug]/page.tsx # Company detail with reliability breakdown
│   ├── reports/page.tsx          # Report submission form + AI classification
│   ├── tracker/page.tsx          # Offer status watchdog
│   ├── backup-planner/page.tsx   # AI backup career planner
│   ├── methodology/page.tsx      # Methodology & transparency docs
│   └── api/                      # API routes
│       ├── dashboard/route.ts
│       ├── companies/route.ts
│       ├── companies/[slug]/route.ts
│       ├── reports/route.ts
│       ├── tracker/route.ts
│       ├── backup-plan/route.ts
│       └── classify-report/route.ts
├── components/layout/Navbar.tsx  # Responsive navbar
├── lib/
│   ├── db/
│   │   ├── seed.ts               # 25 demo reports across 6 companies
│   │   ├── store.ts              # Data access used by API routes (async)
│   │   ├── config.ts             # Picks Supabase or in-memory backend from env
│   │   ├── supabase-repository.ts # PostgreSQL backend
│   │   ├── memory-repository.ts  # In-memory demo backend
│   │   └── http.ts               # API error/response helpers
│   ├── abuse/submissions.ts      # Rate limits and submitter hashing
│   ├── import/                   # Documented-outcome import pipeline
│   ├── privacy.ts                # Personal-data detection
│   ├── scoring/reliability.ts    # Reliability indicator engine
│   ├── alerts/engine.ts          # Alert generation rules
│   ├── ai/
│   │   ├── backup-planner.ts     # Plan orchestration + rule-based template
│   │   ├── claude-planner.ts     # Claude-backed plan generation (server-only)
│   │   └── classifier.ts        # Text classification engine
│   └── validation/schemas.ts     # Zod validation schemas
└── types/index.ts                # Core TypeScript types
```

## Reliability Indicator Formula

```
Basis:     real (non-demo) reports only; demo data only when nothing else exists (labelled "Demo data")
Scored:    final outcomes only. Joining Confirmed = positive; Joining Delayed, Offer Revoked = negative
           (Offer Received / BG Verification Pending are shown but never scored)
Weight:    recency (≤ 183 days: 1.5, older: 0.7) × severity (revoked: 2, else 1)
           × day cap (community reports per company per day share ≤ 3 units)
score   =  100 × (P + 2.5) / (P + N + 5)      P, N = weighted positive / negative sums
           null ("Insufficient Data") with fewer than 3 scored outcomes

Labels:    < 40 Caution Advised · 40–59 Mixed Reports · 60–79 Mostly Positive · ≥ 80 Highly Positive
Confidence from effective sample size; capped at Medium without any verified outcome
```

Not a probability and not validated against real outcomes. The `/methodology` page renders the formula from the
constants in `src/lib/scoring/reliability.ts`, so the two cannot drift apart.

## Demo Data

The app ships with 25 seed reports across 6 companies (Infosys, TCS, Wipro, Cognizant, Deloitte, Capgemini). All demo data is clearly labelled throughout the UI (`isDemo` / `is_demo`). With Supabase configured, submitted reports and tracker changes persist across restarts; in memory mode they reset on restart.

## Ethical Considerations

- All data is self-reported and unverified — clearly disclosed
- No offer letters, personal identifiers, or confidential communications stored
- Reliability scores are not statistical probabilities — methodology is fully transparent
- Absence of reports is not treated as proof of reliability
- Demo data is labelled; no real survey responses or statistics are fabricated
- Every alert includes a disclaimer about data limitations

## Extending

**Enable the AI planner:** set `ANTHROPIC_API_KEY` (server-only) and a spend limit in the Anthropic console. The planner
(`src/lib/ai/claude-planner.ts`) uses Claude Opus 5.5 with structured output, a 20 s timeout, server-side refusal
fallback and a per-client cap; any failure falls back to the template. Tests mock the provider (no paid calls).

## Environment Variables

| Name | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes (production) | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Yes (production) | Server-only secret / service-role key |
| `AAGEY_STORAGE` | Recommended: `supabase` | Fail with 503 instead of silently using memory |
| `ANTHROPIC_API_KEY` | Optional | Enables the Claude-backed Backup Planner |
| `AAGEY_RATE_LIMIT_SECRET` | Optional | Key for submitter hashes (defaults to a value derived from `SUPABASE_SECRET_KEY`) |
| `AAGEY_DB_TEST` | Tests only | `1` runs the live integration tests |

None of these may use a `NEXT_PUBLIC_` prefix. Security and privacy details: [docs/security.md](docs/security.md).

## License

Hackathon project — demo application for educational purposes.
