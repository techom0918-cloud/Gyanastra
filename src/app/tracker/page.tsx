'use client';

import { useEffect, useState } from 'react';
import { TrackedOffer, OFFER_STATUS_LABELS, OFFER_STATUS_COLORS, OfferStatus, Alert } from '@/types';
import { Bell, Plus, Clock, AlertTriangle, AlertOctagon, Info, ChevronDown, ChevronUp } from 'lucide-react';

function AlertCard({ alert }: { alert: Alert }) {
  const severityStyles: Record<string, { bg: string; border: string; text: string; icon: typeof AlertTriangle }> = {
    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: AlertOctagon },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: AlertTriangle },
    low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: Info },
  };
  const s = severityStyles[alert.severity] || severityStyles.low;

  return (
    <div className={`${s.bg} ${s.border} border rounded-xl p-4`}>
      <div className="flex items-start gap-3">
        <s.icon className={`w-5 h-5 ${s.text} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${s.text}`}>{alert.title}</p>
          <p className={`text-sm ${s.text} opacity-80 mt-1`}>{alert.message}</p>
          <p className="text-xs text-gray-400 mt-2 italic">{alert.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}

export default function TrackerPage() {
  const [offers, setOffers] = useState<TrackedOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedOffer, setExpandedOffer] = useState<string | null>(null);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('');
  const [offerDate, setOfferDate] = useState('');
  const [expectedJoiningDate, setExpectedJoiningDate] = useState('');
  const [currentStatus, setCurrentStatus] = useState<OfferStatus>('offer_received');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchOffers = () => {
    fetch('/api/tracker')
      .then((r) => r.json())
      .then((d) => setOffers(d.offers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOffers(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          role: role || undefined,
          offerDate: offerDate || undefined,
          expectedJoiningDate: expectedJoiningDate || undefined,
          currentStatus,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add offer');
      }
      setCompanyName('');
      setRole('');
      setOfferDate('');
      setExpectedJoiningDate('');
      setCurrentStatus('offer_received');
      setNotes('');
      setShowForm(false);
      fetchOffers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const allAlerts = offers.flatMap((o) => o.alerts);
  const highAlerts = allAlerts.filter((a) => a.severity === 'high');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Offer Status Watchdog</h1>
          <p className="text-gray-500 text-sm mt-1">Track your offers and get community-informed alerts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Track Offer
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Add Offer to Track</h2>
          <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Infosys"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Software Engineer"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Offer Date</label>
              <input
                type="date"
                value={offerDate}
                onChange={(e) => setOfferDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expected Joining Date</label>
              <input
                type="date"
                value={expectedJoiningDate}
                onChange={(e) => setExpectedJoiningDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Current Status</label>
              <select
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value as OfferStatus)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {(Object.keys(OFFER_STATUS_LABELS) as OfferStatus[]).map((s) => (
                  <option key={s} value={s}>{OFFER_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Any additional details..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            {formError && (
              <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg">{formError}</div>
            )}
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={!companyName || submitting}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add Offer'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alert Summary */}
      {highAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-red-600" />
            <span className="text-sm font-semibold text-red-800">
              {highAlerts.length} high-priority alert{highAlerts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-red-600">Review the alerts below for your tracked offers.</p>
        </div>
      )}

      {/* Tracked Offers */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">No offers being tracked yet.</p>
          <p className="text-sm text-gray-400 mb-4">
            Add an offer to monitor its status against community reports and receive alerts.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Track Your First Offer
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {offers.map((offer) => {
            const isExpanded = expandedOffer === offer.id;
            return (
              <div key={offer.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedOffer(isExpanded ? null : offer.id)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm">{offer.companyName}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {offer.role && `${offer.role} • `}
                        {offer.expectedJoiningDate && `Expected: ${offer.expectedJoiningDate}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {offer.alerts.length > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        {offer.alerts.length} alert{offer.alerts.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: OFFER_STATUS_COLORS[offer.currentStatus] + '18',
                        color: OFFER_STATUS_COLORS[offer.currentStatus],
                      }}
                    >
                      {OFFER_STATUS_LABELS[offer.currentStatus]}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                    {/* Details */}
                    <div className="grid sm:grid-cols-3 gap-3 text-sm">
                      {offer.offerDate && (
                        <div>
                          <span className="text-xs text-gray-400">Offer Date</span>
                          <p className="font-medium">{offer.offerDate}</p>
                        </div>
                      )}
                      {offer.expectedJoiningDate && (
                        <div>
                          <span className="text-xs text-gray-400">Expected Joining</span>
                          <p className="font-medium">{offer.expectedJoiningDate}</p>
                        </div>
                      )}
                      {offer.lastCommunicationDate && (
                        <div>
                          <span className="text-xs text-gray-400">Last Communication</span>
                          <p className="font-medium">{offer.lastCommunicationDate}</p>
                        </div>
                      )}
                    </div>

                    {offer.notes && (
                      <div>
                        <span className="text-xs text-gray-400">Notes</span>
                        <p className="text-sm text-gray-600 mt-1">{offer.notes}</p>
                      </div>
                    )}

                    {/* Alerts */}
                    {offer.alerts.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          Community-Informed Alerts
                        </p>
                        <div className="space-y-2">
                          {offer.alerts.map((alert) => (
                            <AlertCard key={alert.id} alert={alert} />
                          ))}
                        </div>
                      </div>
                    )}

                    {offer.alerts.length === 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700 flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0" />
                        No community alerts at this time. This does not guarantee a positive outcome.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <strong>Note:</strong> Alerts are generated from community-reported data and rule-based analysis.
        They are not predictions or guarantees. Always verify information through official company channels.
      </div>
    </div>
  );
}
