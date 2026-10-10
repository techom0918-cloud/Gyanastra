'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react';
import { OfferReport, OFFER_STATUS_LABELS, OFFER_STATUS_COLORS } from '@/types';

interface DashboardData {
  stats: { total: number; companies: number; delayed: number; revoked: number; confirmed: number };
  recentReports: OfferReport[];
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{label}</span>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load dashboard');
        return r.json();
      })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-gray-500">
        Unable to load dashboard data. Please try again.
      </div>
    );
  }

  const { stats, recentReports } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Community-reported campus placement data overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Reports" value={stats.total} icon={FileText} color="#3b82f6" />
        <StatCard label="Companies" value={stats.companies} icon={BarChart3} color="#6366f1" />
        <StatCard label="Confirmed" value={stats.confirmed} icon={CheckCircle} color="#22c55e" />
        <StatCard label="Delayed" value={stats.delayed} icon={AlertTriangle} color="#f97316" />
        <StatCard label="Revoked" value={stats.revoked} icon={XCircle} color="#ef4444" />
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Link href="/reports" className="bg-blue-50 border border-blue-200 rounded-xl p-4 hover:bg-blue-100 transition-colors">
          <p className="font-semibold text-blue-700 text-sm">Submit a Report</p>
          <p className="text-xs text-blue-600 mt-1">Share your offer outcome anonymously</p>
        </Link>
        <Link href="/tracker" className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 hover:bg-emerald-100 transition-colors">
          <p className="font-semibold text-emerald-700 text-sm">Track Your Offer</p>
          <p className="text-xs text-emerald-600 mt-1">Monitor status and get alerts</p>
        </Link>
        <Link href="/backup-planner" className="bg-violet-50 border border-violet-200 rounded-xl p-4 hover:bg-violet-100 transition-colors">
          <p className="font-semibold text-violet-700 text-sm">AI Backup Planner</p>
          <p className="text-xs text-violet-600 mt-1">Generate a personalised career backup plan</p>
        </Link>
      </div>

      {/* Recent reports */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">Recent Reports</h2>
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Demo data</span>
        </div>
        <div className="divide-y divide-gray-100">
          {recentReports.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Link href={`/companies/${r.companySlug}`} className="font-medium text-sm text-blue-600 hover:underline truncate">
                  {r.companyName}
                </Link>
                {r.role && <span className="text-xs text-gray-400 hidden sm:inline">• {r.role}</span>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: OFFER_STATUS_COLORS[r.status] + '18',
                    color: OFFER_STATUS_COLORS[r.status],
                  }}
                >
                  {OFFER_STATUS_LABELS[r.status]}
                </span>
                <span className="text-xs text-gray-400">{r.reportedAt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
