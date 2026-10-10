import Link from 'next/link';

export default function MethodologyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Methodology &amp; Transparency</h1>
      <p className="text-gray-500 text-sm mb-8">
        How Aagey AI calculates scores, classifies reports, and generates recommendations
      </p>

      {/* Reliability Indicator */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Reliability Indicator Formula</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>
            The reliability indicator is a transparent, community-data-driven score between 0 and 100.
            It is <strong>not</strong> a statistically validated probability — it is a summary of
            self-reported community data designed to help students assess risk.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs">
            <p className="font-semibold text-gray-800 mb-2">Step 1 — Weighted Counts</p>
            <p>Each report is assigned a recency weight:</p>
            <p className="ml-4 mt-1">• Reports from the last 6 months → weight 1.5</p>
            <p className="ml-4">• Older reports → weight 0.7</p>
            <p className="mt-2">&quot;Positive&quot; statuses: Offer Received, BG Verification Pending, Joining Confirmed</p>
            <p>&quot;Negative&quot; statuses: Joining Delayed, Offer Revoked</p>

            <p className="font-semibold text-gray-800 mt-4 mb-2">Step 2 — Raw Score</p>
            <p>rawScore = (weightedPositive / weightedTotal) × 100</p>

            <p className="font-semibold text-gray-800 mt-4 mb-2">Step 3 — Revocation Penalty</p>
            <p>Each revocation deducts 15 points (max penalty: 45)</p>
            <p>adjustedScore = rawScore − revocationPenalty</p>

            <p className="font-semibold text-gray-800 mt-4 mb-2">Step 4 — Small-Sample Damping</p>
            <p>When report count &lt; 10:</p>
            <p className="ml-4">damping = reportCount / 10</p>
            <p className="ml-4">finalScore = 50 + (adjustedScore − 50) × damping</p>
            <p className="mt-1">This pulls extreme scores toward 50 when data is sparse.</p>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-2">Label Thresholds</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="bg-gray-100 rounded-lg p-2">
                <span className="font-medium" style={{ color: '#9ca3af' }}>Insufficient Data</span>
                <p className="text-gray-500 mt-0.5">&lt; 3 reports</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <span className="font-medium" style={{ color: '#ef4444' }}>Caution Advised</span>
                <p className="text-gray-500 mt-0.5">Score &lt; 40</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2">
                <span className="font-medium" style={{ color: '#f59e0b' }}>Mixed Reports</span>
                <p className="text-gray-500 mt-0.5">Score 40–59</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <span className="font-medium" style={{ color: '#3b82f6' }}>Mostly Positive</span>
                <p className="text-gray-500 mt-0.5">Score 60–79</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2">
                <span className="font-medium" style={{ color: '#22c55e' }}>Highly Positive</span>
                <p className="text-gray-500 mt-0.5">Score ≥ 80</p>
              </div>
            </div>
          </div>

          <div>
            <p className="font-semibold text-gray-800 mb-1">Confidence Levels</p>
            <p>Low: &lt; 5 reports &nbsp;|&nbsp; Medium: 5–14 reports &nbsp;|&nbsp; High: 15+ reports</p>
          </div>
        </div>
      </section>

      {/* AI Classification */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">AI Report Classification</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-700 leading-relaxed space-y-3">
          <p>
            When a user provides a text description of their offer experience, the system analyses the text
            using a keyword-based NLP classifier. This is <strong>not</strong> a large language model — it uses
            weighted keyword matching to suggest a status category.
          </p>
          <p>
            The classifier looks for keywords related to each offer status (e.g., &quot;revoked&quot;, &quot;cancelled&quot;
            for Offer Revoked; &quot;delayed&quot;, &quot;postponed&quot; for Joining Delayed) and extracts
            numeric delay durations from the text.
          </p>
          <p>
            Classification results are always presented as <em>suggestions</em> with a confidence score.
            The user must confirm or override the suggestion before submission.
          </p>
        </div>
      </section>

      {/* Backup Planner */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">AI Backup Career Planner</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-700 leading-relaxed space-y-3">
          <p>
            The planner generates personalised backup career plans based on user-provided inputs including
            skills, degree, preferred role, location preferences, and current offer status.
          </p>
          <p>
            In demo mode, the system uses rule-based generation templates tailored to the urgency level
            of the offer status. When an AI API key is configured, the system can use a language model
            for more nuanced, context-aware plans.
          </p>
          <p>
            Plans include immediate actions, 4-week goal breakdowns, skill development recommendations
            with learning resources, job application strategy, and interview preparation tips.
          </p>
          <p className="font-semibold text-amber-700">
            Plans are for informational purposes only. They do not guarantee employment outcomes and
            should not be the sole basis for career decisions.
          </p>
        </div>
      </section>

      {/* Alert Engine */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Offer Status Watchdog Alerts</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-700 leading-relaxed space-y-3">
          <p>
            The alert engine uses deterministic rules (not AI) to generate alerts based on community data:
          </p>
          <ul className="space-y-2 ml-4">
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">High:</span>
              <span>Recent offer revocations reported for the same company (within 3 months)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 font-bold">Medium:</span>
              <span>Delay trend detected — 2 or more delay reports within 3 months</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 font-bold">Medium:</span>
              <span>Expected joining date has passed without a confirmed joining report</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">Low:</span>
              <span>Low community report count — insufficient data to assess trends</span>
            </li>
          </ul>
          <p>
            Every alert includes a disclaimer stating that it is based on community reports and may not
            reflect the actual situation.
          </p>
        </div>
      </section>

      {/* Data & Privacy */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Data &amp; Privacy</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-700 leading-relaxed space-y-3">
          <p>
            All data in this demo application is self-reported by community members or generated as
            seed data. Seed data is clearly labelled throughout the application.
          </p>
          <ul className="space-y-1 ml-4">
            <li>• No personal identifiers are collected or stored</li>
            <li>• No offer letters, recruiter emails, or confidential documents are stored</li>
            <li>• Reports are anonymous — no login or account is required</li>
            <li>• The demo uses in-memory storage (data resets on server restart)</li>
          </ul>
        </div>
      </section>

      {/* Limitations */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">Known Limitations</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900 leading-relaxed space-y-3">
          <ul className="space-y-2">
            <li>
              <strong>Self-reporting bias:</strong> Students who had negative experiences may be more likely to report,
              potentially skewing data toward negative outcomes.
            </li>
            <li>
              <strong>Small sample sizes:</strong> Most companies have fewer than 20 reports, which limits
              the statistical significance of the reliability indicator.
            </li>
            <li>
              <strong>No verification:</strong> Reports are not independently verified. The system relies on
              community good faith.
            </li>
            <li>
              <strong>Temporal bias:</strong> Placement patterns change year to year. Historical data may not
              predict current outcomes.
            </li>
            <li>
              <strong>Absence ≠ reliability:</strong> A company with no negative reports may simply have
              few reports overall, not necessarily a positive track record.
            </li>
            <li>
              <strong>Demo data:</strong> Seed data is synthetic and labelled as such. It exists to demonstrate
              functionality, not to make claims about real companies.
            </li>
          </ul>
        </div>
      </section>

      <div className="text-center text-sm text-gray-400 pb-8">
        <p>
          Questions? See the{' '}
          <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link> or{' '}
          <Link href="/companies" className="text-blue-600 hover:underline">Company Explorer</Link> to see
          the methodology in action.
        </p>
      </div>
    </div>
  );
}
