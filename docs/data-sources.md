# Data source register

Sources researched for importing documented offer outcomes (see [data-import.md](data-import.md)).
**Nothing listed here has been imported.** Importing any of it needs a reviewer's decision and explicit approval.
"Opened" means the page was fetched and read on the research date. It does **not** mean the claims are verified.

Research date for every entry: **2026-10-10**. Pages change. Re-open each one before using it.

## How to read this register

| Category | What it can support | What it cannot support |
|---|---|---|
| **Official company statement** | A company-level outcome stated by the company itself (e.g. "everyone with an offer will be onboarded") | Any individual student's outcome |
| **News report** (often quoting a union) | One `news_report` record per article for a company-level event, `verificationStatus: unverified` until a reviewer checks it against a primary source | Per-student records, or splitting "250 affected" into 250 rows |
| **Institution aggregate statistics** (NIRF, placement reports) | Nothing in `offer_reports`. They describe how many students an institute placed and at what pay | Any statement that a specific offer was delayed or revoked. The importer rejects `aggregate_statistic` |
| **Community submissions** | Self-reported individual outcomes, via the app's Submit Report form | Verification. These stay `community` |
| **Demo records** | UI demonstration only (`is_demo = true`) | Any real-world claim. The scoring never mixes them with real data |

## Candidate records (opened, not imported)

Each would be **one** record, `evidenceType: news_report`, `verificationStatus: unverified`. The claims come
from an IT workers' union (NITES) as reported by the press, and the company's side is missing or partial.
All were published more than 183 days before the research date, so they would score at the older weight (0.7).

| # | Source (opened 2026-10-10) | Published | Company | What it reports | Limitations |
|---|---|---|---|---|---|
| 1 | [Outlook Business — Wipro delayed onboarding of over 250 freshers, NITES complains to Labour Ministry](https://www.outlookbusiness.com/corporate/wipro-delayed-onboarding-of-over-250-freshers-nites-complains-to-labour-ministry) | 2026-01-19 | Wipro | Over 250 freshers issued letters of intent around May 2025 not yet onboarded (`joining_delayed`) | Union complaint, reported second-hand; the article says Wipro did not reply. Company-level, not individual. |
| 2 | [The News Minute — Infosys to face govt probe over delayed recruitment of over 2,000 graduates](https://www.thenewsminute.com/news/infosys-to-face-govt-probe-over-delayed-recruitment-of-over-2000-graduates) | 2024-09-06 | Infosys | Labour Ministry asked Karnataka to act on onboarding delays for the 2022-23 campus batch (`joining_delayed`) | The ministry directive is about investigating the complaint, not a finding. No Infosys statement in the article. |
| 3 | [Business Today — IT union NITES files complaint against Wipro with Labour Ministry](https://www.businesstoday.in/latest/corporate/story/it-employee-union-nites-files-complaint-against-wipro-with-labour-ministry-371074-2023-02-22) | 2023-02-22 | Wipro | Recruits waiting over a year offered onboarding at a reduced CTC (`joining_delayed`) | A revised lower offer does not fit the existing statuses exactly. Counts in the article are disputed (company vs. unnamed sources). |
| 4 | [Angel One — TCS assures onboarding after NITES flags delay for 600 experienced professionals](https://www.angelone.in/news/share-market/tcs-assures-onboarding-after-nites-flags-delay-for-600-experienced-professionals) | 2025-07-24 | TCS | TCS: "Everyone who has received an offer from TCS will be onboarded" | **Out of scope:** the affected group is experienced hires, not campus offers. Kept only as an example of a company statement. Do not import as a campus outcome. |

Found in search results but **could not be opened** by the research tool (HTTP 403). They are not verified here:
Deccan Herald (NITES approaches Labour Ministry over onboarding delay at Wipro) and BusinessWorld (Labour
Ministry directs Karnataka govt to act on Infosys freshers' onboarding delays). A reviewer may open them in a browser.

## Aggregate-only source (never imported as outcomes)

| Source | What it is | Why it is not importable |
|---|---|---|
| [NIRF — National Institutional Ranking Framework](https://www.nirfindia.org/) (Ministry of Education) | Institutional rankings; institutions submit data that includes graduation and placement figures | Institution-level aggregates (counts, medians). They say nothing about whether any specific offer was honoured. The site does not define "placed". |

## Terms and permission notes

- Record **facts plus a link** only. Don't copy article text, images or documents into Aagey.
- Don't use automated scraping on news sites. Several block automated access (HTTP 403), and their terms generally
  restrict reuse. Each record is entered by hand by a reviewer.
- Never collect from student-only portals, placement-cell logins, private groups or anything behind access controls.
- Articles that name individual students: record only the company-level fact, never the name.

## Before turning a candidate into a record

1. Re-open the source and confirm it still says what the register says.
2. Look for a primary source (the company's own statement, the ministry order, or a placement-cell notice that is
   public). Only then consider `verificationStatus: verified`, with `verifiedAt` and a `verificationNote`
   describing exactly what was compared.
3. Run the importer's dry run and resolve every rejection and possible duplicate.
4. Get approval from the project owner before running `--commit` against production.
