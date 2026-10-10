import { TrackedOffer, OfferReport, Alert } from '@/types';

const DISCLAIMER = 'Community reports do not establish that your individual offer is at risk. Contact your recruiter for official information.';

export function generateAlerts(offer: TrackedOffer, companyReports: OfferReport[]): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();

  // Recent reports (last 3 months)
  const recent = companyReports.filter((r) => {
    const d = new Date(r.reportedAt);
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return diff <= 3;
  });

  // Alert: Recent revocations
  const recentRevocations = recent.filter((r) => r.status === 'offer_revoked');
  if (recentRevocations.length > 0) {
    alerts.push({
      id: `alert-revoke-${offer.id}`,
      type: 'revocation',
      title: 'Recent revocation reports',
      message: `${recentRevocations.length} revocation report${recentRevocations.length > 1 ? 's' : ''} for ${offer.companyName} in the last 3 months.`,
      severity: 'high',
      createdAt: now.toISOString(),
      reportCount: recentRevocations.length,
      disclaimer: DISCLAIMER,
    });
  }

  // Alert: Delay trend
  const recentDelays = recent.filter((r) => r.status === 'joining_delayed');
  if (recentDelays.length >= 2) {
    const avgDelay = recentDelays.reduce((s, r) => s + (r.delayWeeks || 0), 0) / recentDelays.length;
    alerts.push({
      id: `alert-delay-${offer.id}`,
      type: 'delay',
      title: 'Delay trend detected',
      message: `${recentDelays.length} delay reports in the last 3 months (avg ~${Math.round(avgDelay)} weeks). Consider preparing a backup plan.`,
      severity: 'medium',
      createdAt: now.toISOString(),
      reportCount: recentDelays.length,
      disclaimer: DISCLAIMER,
    });
  }

  // Alert: Expected joining date passed
  if (offer.expectedJoiningDate) {
    const joinDate = new Date(offer.expectedJoiningDate);
    if (now > joinDate && offer.currentStatus !== 'joining_confirmed') {
      const daysPast = Math.round((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: `alert-overdue-${offer.id}`,
        type: 'info',
        title: 'Expected joining date has passed',
        message: `Your expected joining date was ${daysPast} day${daysPast > 1 ? 's' : ''} ago and status is not confirmed. Follow up with your recruiter.`,
        severity: daysPast > 30 ? 'high' : 'medium',
        createdAt: now.toISOString(),
        disclaimer: DISCLAIMER,
      });
    }
  }

  // Info: low report count
  if (companyReports.length < 3) {
    alerts.push({
      id: `alert-lowdata-${offer.id}`,
      type: 'info',
      title: 'Limited community data',
      message: `Only ${companyReports.length} report${companyReports.length !== 1 ? 's' : ''} available for ${offer.companyName}. Community data may not be representative.`,
      severity: 'low',
      createdAt: now.toISOString(),
      reportCount: companyReports.length,
      disclaimer: DISCLAIMER,
    });
  }

  return alerts;
}
