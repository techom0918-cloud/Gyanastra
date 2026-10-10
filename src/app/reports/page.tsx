'use client';

import { useState } from 'react';
import Link from 'next/link';
import { OFFER_STATUS_LABELS, OFFER_STATUS_COLORS, OfferStatus, ClassificationResult } from '@/types';
import { Send, Sparkles, CheckCircle } from 'lucide-react';

export default function ReportSubmissionPage() {
  const [companyName, setCompanyName] = useState('');
  const [status, setStatus] = useState<OfferStatus>('offer_received');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [delayWeeks, setDelayWeeks] = useState('');

  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [classifying, setClassifying] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleClassify = async () => {
    if (description.length < 5) return;
    setClassifying(true);
    setClassification(null);
    try {
      const res = await fetch('/api/classify-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (data.classification) {
        setClassification(data.classification);
      }
    } catch {
      // silently fail — classification is optional
    } finally {
      setClassifying(false);
    }
  };

  const applyClassification = () => {
    if (!classification) return;
    setStatus(classification.proposedStatus);
    if (classification.delayWeeks) {
      setDelayWeeks(String(classification.delayWeeks));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        companyName,
        status,
        description: description || undefined,
        role: role || undefined,
        graduationYear: graduationYear ? Number(graduationYear) : undefined,
        delayWeeks: delayWeeks ? Number(delayWeeks) : undefined,
      };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-emerald-50 rounded-2xl p-8 border border-emerald-200">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-emerald-800 mb-2">Report Submitted</h2>
          <p className="text-sm text-emerald-700 mb-6">
            Thank you for contributing to the community. Your report helps other students make
            informed decisions about their offer outcomes.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setSubmitted(false);
                setCompanyName('');
                setStatus('offer_received');
                setDescription('');
                setRole('');
                setGraduationYear('');
                setDelayWeeks('');
                setClassification(null);
              }}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              Submit Another
            </button>
            <Link href="/companies" className="px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50">
              View Companies
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Submit Offer Report</h1>
        <p className="text-gray-500 text-sm mt-1">
          Anonymously share your campus placement offer outcome to help the community
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Infosys, TCS, Wipro"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Offer Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Offer Status <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(OFFER_STATUS_LABELS) as OfferStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium text-left border transition-all ${
                  status === s
                    ? 'ring-2 ring-offset-1'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={
                  status === s
                    ? {
                        borderColor: OFFER_STATUS_COLORS[s],
                        backgroundColor: OFFER_STATUS_COLORS[s] + '10',
                        color: OFFER_STATUS_COLORS[s],
                        // @ts-expect-error CSS custom property for ring color
                        '--tw-ring-color': OFFER_STATUS_COLORS[s],
                      }
                    : {}
                }
              >
                {OFFER_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Description with AI Classification */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your offer experience. e.g. 'Received offer in December, joining was supposed to be in July but has been delayed by 3 months with no clear update...'"
            rows={4}
            maxLength={1000}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-400">{description.length}/1000</span>
            {description.length >= 10 && (
              <button
                type="button"
                onClick={handleClassify}
                disabled={classifying}
                className="inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {classifying ? 'Analysing...' : 'AI Auto-detect Status'}
              </button>
            )}
          </div>

          {/* Classification Result */}
          {classification && (
            <div className="mt-3 bg-violet-50 border border-violet-200 rounded-xl p-4">
              <p className="text-sm font-medium text-violet-800 mb-1">AI Classification Suggestion</p>
              <p className="text-sm text-violet-700 mb-2">{classification.summary}</p>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: OFFER_STATUS_COLORS[classification.proposedStatus] + '18',
                    color: OFFER_STATUS_COLORS[classification.proposedStatus],
                  }}
                >
                  {OFFER_STATUS_LABELS[classification.proposedStatus]}
                </span>
                <span className="text-xs text-violet-500">
                  Confidence: {(classification.confidence * 100).toFixed(0)}%
                </span>
                <button
                  type="button"
                  onClick={applyClassification}
                  className="text-xs font-medium text-violet-600 hover:text-violet-800 underline ml-auto"
                >
                  Apply suggestion
                </button>
              </div>
              <p className="text-xs text-violet-500 mt-2">
                This is a keyword-based classification, not a guarantee. Always verify the status yourself.
              </p>
            </div>
          )}
        </div>

        {/* Delay Weeks (conditional) */}
        {(status === 'joining_delayed' || classification?.delayWeeks) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Delay (weeks)
            </label>
            <input
              type="number"
              min="0"
              max="200"
              value={delayWeeks}
              onChange={(e) => setDelayWeeks(e.target.value)}
              placeholder="e.g. 12"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role / Position <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Software Engineer, Analyst"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Graduation Year */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Graduation Year <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="number"
            min="2015"
            max="2030"
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
            placeholder="e.g. 2025"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!companyName || submitting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>

      {/* Privacy note */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500">
        <strong>Privacy:</strong> No personal identifiers, offer letters, or confidential communications are stored.
        Reports are anonymous. By submitting, you confirm the information is truthful to the best of your knowledge.
      </div>
    </div>
  );
}
