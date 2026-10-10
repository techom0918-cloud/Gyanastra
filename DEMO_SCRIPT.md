# Aagey AI — 3-Minute Demo Script

## Opening (15 seconds)

> "Every year, lakhs of students receive campus placement offers — but many face delays, unclear timelines, or even revocations. They stop preparing, stop applying, and have no way to know what's coming. Aagey AI changes that."

## Module 1 — Offer Reliability Tracker (60 seconds)

1. **Landing page** → Click "Explore Companies"
2. **Company Explorer** → Show the list of 6 companies with reliability scores and status bars
   - Point out: "Each company has a transparent reliability score based on community reports"
3. **Search** → Type "Infosys" to demo filtering
4. **Click Infosys** → Company detail page
   - Show the score (67, Mostly Positive) and confidence level
   - Show the **Reliability Explanation box** — "The formula is fully documented. Recency weighting gives 1.5x weight to recent reports, there's a revocation penalty, and small-sample damping prevents extreme scores from tiny datasets"
   - Show the **status distribution chart** — visual breakdown of all report outcomes
   - Scroll to **individual reports** — each with status badges and demo labels
5. **Methodology page** → Quick scroll to show the complete formula documentation

> "No black-box scores. Every input to the formula is visible."

## Module 2 — Submit Report + AI Classification (45 seconds)

1. **Click "Submit Report"** in navbar
2. Fill in:
   - Company: "Accenture"
   - Paste description: "Received offer in January but joining has been delayed by 4 months. No communication from HR since March."
3. **Click "AI Auto-detect Status"**
   - Show the classification result: Joining Delayed, confidence %, extracted delay
   - Click "Apply suggestion" to auto-fill
4. **Submit** → Show success state

> "The AI classifier analyses text and suggests a status — but the student always confirms."

## Module 3 — Offer Status Watchdog (45 seconds)

1. **Click "Track Offer"** in navbar
2. Show the **existing tracked offer** (Infosys, BG Verification Pending from seed data)
   - Expand it to show alerts and details
3. **Click "Track Offer" button** → Fill in:
   - Company: "Wipro"
   - Status: Joining Delayed
   - Expected joining: (past date)
4. **Submit** → Show the new offer with auto-generated alerts
   - Point out: "Alerts are rule-based, not AI. Recent revocation reports at Wipro trigger a high-severity alert."
   - Show the **disclaimer** on every alert

> "Deterministic alerts, not hallucinations. Every alert cites community data and includes limitations."

## Module 4 — AI Backup Planner (30 seconds)

1. **Click "Backup Planner"** in navbar
2. Fill in:
   - Skills: Python, SQL, React
   - Degree: B.Tech Computer Science
   - Role: Full-Stack Developer
   - Status: Joining Delayed
3. **Generate** → Show the structured plan:
   - Immediate actions
   - 4-week breakdown
   - Skills with learning resources
   - Application strategy
   - Interview prep

> "A structured, actionable backup plan — not generic career advice."

## Closing (15 seconds)

- Show the **Dashboard** — unified overview with stats and quick actions
- Point to the **demo data banner** — "Everything is labelled as demo data. We don't fabricate statistics."
- "Aagey AI: transparent data, honest limitations, and AI that helps students prepare — not just hope."

---

## Key Talking Points for Judges

1. **Transparency over accuracy** — we document our formula rather than hide it
2. **Honest limitations** — small samples, self-reporting bias, and temporal bias are all disclosed
3. **Privacy-first** — no PII, no offer letters, anonymous reports
4. **No fabricated data** — all demo data is clearly labelled
5. **Production-ready architecture** — Supabase-swappable data layer, OpenAI-swappable planner
6. **Three complementary modules** — track, analyse, and plan in one platform
