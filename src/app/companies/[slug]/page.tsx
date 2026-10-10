'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Company, OfferReport, OFFER_STATUS_LABELS, OFFER_STATUS_COLORS, OfferStatus } from '@/types';
import { ArrowLeft, Info } from 'lucide-react';

const LABEL_COLORS: Record<string, string> = {
  'Insufficient Data': '#9ca3af',
  'Caution Advised': '#ef4444',
  'Mixed Reports': '#f59e0b',
  'Mostly Positive': '#3b82f6',
  'Highly Positive': '#22c55e',
};

function CompanyDetailInner() {
  const { slug } = useParams<{ slug: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [reports, setReports] = useState<OfferReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/companies/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d) => {
        setCompany(d.company);
        setReports(d.reports);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 mb-4">Company not found.</p>
        <Link href="/companies" className="text-blue-600 hover:underline text-sm">
          ← Back to Company Explorer
        </Link>
      </div>
    );
  }

  const ri = company.reliabilityIndicator;
  const labelColor = LABEL_COLORS[ri.label] || '#6b7280';

  const statusEntries = (Object.keys(OFFER_STATUS_LABELS) as OfferStatus[]).map((status) => ({
    status,
    label: OFFER_STATUS_LABELS[status],
    count: company.statusDistribution[status] || 0,
    color: OFFER_STATUS_COLORS[status],
  })).filter((e) => e.count > 0);

  const maxCount = Math.max(...statusEntries.map((e) => e.count), 1);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/companies" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Company Explorer
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {company.reportCount} community report{company.reportCount !== 1 ? 's' : ''}
              {company.latestReportDate && ` • Latest: ${company.latestReportDate}`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {ri.label !== 'Insufficient Data' && (
              <span className="text-3xl font-bold" style={{ color: labelColor }}>
                {ri.score}
              </span>
            )}
            <div className="text-right">
              <span
                className="text-xs font-medium px-3 py-1.5 rounded-full inline-block"
                style={{ backgroundColor: labelColor + '18', color: labelColor }}
              >
                {ri.label}
              </span>
              <p className="text-xs text-gray-400 mt-1">Confidence: {ri.confidence}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reliability Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-800 mb-1">Reliability Indicator Explanation</h3>
            <p className="text-sm text-blue-700 leading-relaxed">{ri.explanation}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-blue-600">
              <span>Total Reports: {ri.totalReports}</span>
              <span>Recent (6 mo): {ri.recentReports}</span>
              <span>Positive Rate: {(ri.positiveRate * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Distribution Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Status Distribution</h2>
        <div className="space-y-3">
          {statusEntries.map((entry) => (
            <div key={entry.status} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-36 shrink-0 text-right">{entry.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  className="h-full rounded-full flex items-center pl-2 text-xs font-medium text-white transition-all duration-500"
                  style={{
                    width: `${Math.max((entry.count / maxCount) * 100, 8)}%`,
                    backgroundColor: entry.color,
                  }}
                >
                  {entry.count}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mt-6 h-3 rounded-full overflow-hidden bg-gray-100">
          {statusEntries.map((entry) => {
            const pct = (entry.count / company.reportCount) * 100;
            return (
              <div
                key={entry.status}
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: entry.color }}
                title={`${entry.label}: ${entry.count} (${pct.toFixed(0)}%)`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          {statusEntries.map((entry) => (
            <span key={entry.status} className="text-xs text-gray-500 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.label}: {entry.count} ({((entry.count / company.reportCount) * 100).toFixed(0)}%)
            </span>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">All Reports ({reports.length})</h2>
          {reports.some((r) => r.isDemo) && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              Includes demo data
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {reports.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              No reports yet. Be the first to{' '}
              <Link href="/reports" className="text-blue-600 hover:underline">submit a report</Link>.
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-medium px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: OFFER_STATUS_COLORS[r.status] + '18',
                          color: OFFER_STATUS_COLORS[r.status],
                        }}
                      >
                        {OFFER_STATUS_LABELS[r.status]}
                      </span>
                      {r.role && <span className="text-xs text-gray-400">{r.role}</span>}
                      {r.graduationYear && <span className="text-xs text-gray-400">Class of {r.graduationYear}</span>}
                      {r.isDemo && <span className="text-xs text-amber-500">Demo</span>}
                    </div>
                    {r.description && (
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{r.description}</p>
                    )}
                    {r.delayWeeks != null && r.delayWeeks > 0 && (
                      <p className="text-xs text-orange-600 mt-1">
                        Reported delay: ~{r.delayWeeks} week{r.delayWeeks !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{r.reportedAt}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <strong>Disclaimer:</strong> All data is self-reported by community members and has not been independently verified.
        Report counts may be small and may not be representative of the full picture. An absence of negative reports does
        not guarantee a positive outcome. See the{' '}
        <Link href="/methodology" className="underline">Methodology</Link> page for details on how the reliability
        indicator is calculated.
      </div>
    </div>
  );
}

export default function CompanyDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-32 bg-gray-200 rounded-xl" />
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        </div>
      }
    >
      <CompanyDetailInner />
    </Suspense>
  );
}
