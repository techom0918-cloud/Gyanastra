'use client';

import { useState } from 'react';
import { OFFER_STATUS_LABELS, OfferStatus, GeneratedPlan } from '@/types';
import { Brain, Loader2, Target, BookOpen, Calendar, Briefcase, MessageSquare, X } from 'lucide-react';

export default function BackupPlannerPage() {
  // Form
  const [skills, setSkills] = useState('');
  const [degree, setDegree] = useState('');
  const [preferredRole, setPreferredRole] = useState('');
  const [locations, setLocations] = useState('');
  const [currentOfferStatus, setCurrentOfferStatus] = useState<OfferStatus>('joining_delayed');
  const [expectedJoiningDate, setExpectedJoiningDate] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');

  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGenerating(true);
    setPlan(null);

    try {
      const res = await fetch('/api/backup-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
          degree,
          preferredRole,
          locationPreferences: locations.split(',').map((l) => l.trim()).filter(Boolean),
          currentOfferStatus,
          expectedJoiningDate: expectedJoiningDate || undefined,
          companyName: companyName || undefined,
          additionalContext: additionalContext || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate plan');
      }

      const data = await res.json();
      setPlan(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Backup Career Planner</h1>
        <p className="text-gray-500 text-sm mt-1">
          Get a personalised backup career plan based on your skills, situation, and offer status
        </p>
      </div>

      {!plan ? (
        <form onSubmit={handleGenerate} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Skills <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Python, SQL, React, Machine Learning"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Degree <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                placeholder="e.g. B.Tech Computer Science"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Role <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={preferredRole}
                onChange={(e) => setPreferredRole(e.target.value)}
                placeholder="e.g. Full-Stack Developer"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Preferences
              </label>
              <input
                value={locations}
                onChange={(e) => setLocations(e.target.value)}
                placeholder="Bangalore, Hyderabad, Remote"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated (optional)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Offer Status <span className="text-red-500">*</span>
              </label>
              <select
                value={currentOfferStatus}
                onChange={(e) => setCurrentOfferStatus(e.target.value as OfferStatus)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              >
                {(Object.keys(OFFER_STATUS_LABELS) as OfferStatus[]).map((s) => (
                  <option key={s} value={s}>{OFFER_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Joining Date</label>
              <input
                type="date"
                value={expectedJoiningDate}
                onChange={(e) => setExpectedJoiningDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Infosys (optional)"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Context</label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Any specific concerns or constraints. e.g. 'I have a 3-month gap since graduation and want to focus on startups...'"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={!skills || !degree || !preferredRole || generating}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Plan...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                Generate Backup Plan
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          {/* Back to form */}
          <button
            onClick={() => setPlan(null)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" /> Generate a new plan
          </button>

          {/* Scenario */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-violet-800 mb-1">Your Scenario</h3>
                <p className="text-sm text-violet-700 leading-relaxed">{plan.scenario}</p>
              </div>
            </div>
          </div>

          {/* Immediate Actions */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold">Immediate Actions</h3>
            </div>
            <ul className="space-y-2">
              {plan.immediateActions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-red-400 font-bold shrink-0">{i + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Weekly Goals */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold">4-Week Plan</h3>
            </div>
            <div className="space-y-4">
              {plan.weeklyGoals.map((wg) => (
                <div key={wg.week} className="border-l-2 border-blue-200 pl-4">
                  <p className="text-sm font-semibold text-blue-700 mb-1">Week {wg.week}</p>
                  <ul className="space-y-1">
                    {wg.goals.map((goal, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Skills to Improve */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold">Skills to Develop</h3>
            </div>
            <div className="space-y-4">
              {plan.skillsToImprove.map((skill, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-800">{skill.skill}</p>
                  <p className="text-xs text-gray-500 mt-1">{skill.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {skill.resources.map((r, j) => (
                      <span key={j} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Application Strategy */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold">Application Strategy</h3>
            </div>
            <ul className="space-y-2">
              {plan.applicationStrategy.map((s, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Interview Prep */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              <h3 className="font-semibold">Interview Preparation</h3>
            </div>
            <ul className="space-y-2">
              {plan.interviewPrep.map((tip, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
            <strong>Disclaimer:</strong> {plan.disclaimer}
          </div>
        </div>
      )}

      {!plan && (
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500">
          <strong>How it works:</strong> The planner generates a structured backup career plan based on your inputs
          and offer status. Plans include immediate actions, weekly goals, skill recommendations with learning resources,
          and job-search strategy. Currently using rule-based generation (API-free demo mode).
        </div>
      )}
    </div>
  );
}
