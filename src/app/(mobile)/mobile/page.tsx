import type { Metadata } from 'next';
import { Building2, ClipboardList, Compass, FilePlus2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { DashboardHeading } from '@/components/features/DashboardView';

export const metadata: Metadata = { title: 'Aagey app' };

const ACTIONS = [
  { href: '/mobile/companies', title: 'Companies', text: 'See community-reported outcomes and reliability.', icon: Building2 },
  { href: '/mobile/report', title: 'Submit a report', text: 'Share what happened with an offer. No account needed.', icon: FilePlus2 },
  { href: '/mobile/offers', title: 'Track an offer', text: 'Keep your own offers and get alerts.', icon: ClipboardList },
  { href: '/career-intelligence', title: 'Career Intelligence', text: 'Private offer, job and 90-day guidance.', icon: Compass },
  { href: '/backup-planner', title: 'Backup planner', text: 'Plan next steps if an offer falls through.', icon: Sparkles },
];

export default function MobileHomePage() {
  return (
    <div>
      <DashboardHeading />
      <ul className="mt-5 space-y-3">
        {ACTIONS.map(({ href, title, text, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand-300">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{title}</span>
                <span className="mt-0.5 block text-xs text-muted">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
