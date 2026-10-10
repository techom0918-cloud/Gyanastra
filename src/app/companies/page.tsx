'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Company, OFFER_STATUS_LABELS, OFFER_STATUS_COLORS } from '@/types';
import { Search } from 'lucide-react';

const LABEL_COLORS: Record<string, string> = {
  'Insufficient Data': '#9ca3af',
  'Caution Advised': '#ef4444',
  'Mixed Reports': '#f59e0b',
  'Mostly Positive': '#3b82f6',
  'Highly Positive': '#22c55e',
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/companies')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load companies');
        return r.json();
      })
      .then((d) => setCompanies(d.companies))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Company Reliability Explorer</h1>
        <p className="text-gray-500 text-sm mt-1">
          Transparent, community-reported offer outcome data
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {search ? 'No companies match your search.' : 'No company data available.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => {
            const ri = c.reliabilityIndicator;
            const labelColor = LABEL_COLORS[ri.label] || '#6b7280';

            return (
              <Link
                key={c.slug}
                href={`/companies/${c.slug}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{c.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {c.reportCount} report{c.reportCount !== 1 ? 's' : ''} •
                      Latest: {c.latestReportDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {ri.label !== 'Insufficient Data' && (
                      <span className="text-2xl font-bold" style={{ color: labelColor }}>
                        {ri.score}
                      </span>
                    )}
                    <span
                      className="text-xs font-medium px-3 py-1.5 rounded-full"
                      style={{
                        backgroundColor: labelColor + '18',
                        color: labelColor,
                      }}
                    >
                      {ri.label}
                    </span>
                  </div>
                </div>

                {/* Mini status bar */}
                <div className="flex gap-1 mt-3 h-2 rounded-full overflow-hidden bg-gray-100">
                  {(Object.keys(OFFER_STATUS_LABELS) as Array<keyof typeof OFFER_STATUS_LABELS>).map((status) => {
                    const count = c.statusDistribution[status] || 0;
                    if (count === 0) return null;
                    const pct = (count / c.reportCount) * 100;
                    return (
                      <div
                        key={status}
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: OFFER_STATUS_COLORS[status],
                        }}
                        title={`${OFFER_STATUS_LABELS[status]}: ${count}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {(Object.keys(OFFER_STATUS_LABELS) as Array<keyof typeof OFFER_STATUS_LABELS>).map((status) => {
                    const count = c.statusDistribution[status] || 0;
                    if (count === 0) return null;
                    return (
                      <span key={status} className="text-xs text-gray-500">
                        <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: OFFER_STATUS_COLORS[status] }} />
                        {OFFER_STATUS_LABELS[status]}: {count}
                      </span>
                    );
                  })}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <strong>Note:</strong> All data is self-reported by community members and may not be representative.
        Demo seed data is labelled accordingly. See the{' '}
        <Link href="/methodology" className="underline">Methodology</Link> page for details.
      </div>
    </div>
  );
}
