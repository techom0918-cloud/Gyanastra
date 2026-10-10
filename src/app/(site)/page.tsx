import { ArrowRight, Bell, Brain, Building2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Logo, TAGLINE } from '@/components/brand/Logo';
import { ButtonLink } from '@/components/ui/Button';

const MODULES = [
  {
    icon: Building2,
    title: 'Offer reliability',
    text: 'See reported outcomes for each company, with the sample size, evidence quality and uncertainty shown next to every score.',
    href: '/companies',
    cta: 'Explore companies',
  },
  {
    icon: Bell,
    title: 'Offer tracker',
    text: 'Track your own offer, compare it with what others report, and get plain-language alerts when a relevant pattern appears.',
    href: '/tracker',
    cta: 'Track an offer',
  },
  {
    icon: Brain,
    title: 'Backup planner',
    text: 'Turn your skills and situation into a practical plan for the next few weeks. Clearly labelled as guidance, not fact.',
    href: '/backup-planner',
    cta: 'Make a plan',
  },
];

const PRINCIPLES = [
  { title: 'Only final outcomes are scored', text: 'Confirmed, delayed or revoked. Offers still in progress are shown, never counted as success.' },
  { title: 'Small samples look small', text: 'A score based on a handful of reports is greyed out and labelled low confidence.' },
  { title: 'Demo data stays demo', text: 'Synthetic records are labelled and are never mixed into scores for real reports.' },
];

export default function LandingPage() {
  return (
    <div>
      <section className="border-b border-line bg-[radial-gradient(70rem_28rem_at_50%_-8%,var(--color-brand-100),transparent)]">
        <div className="mx-auto max-w-4xl px-4 pb-14 pt-10 text-center sm:px-6 sm:pb-20 sm:pt-16">
          <div className="flex justify-center">
            <Logo size="xl" priority />
          </div>
          <h1 className="mx-auto mt-8 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl sm:leading-tight">{TAGLINE}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Campus offers can be delayed or withdrawn, and students are left guessing. Aagey brings together community-reported outcomes, lets you track your own
            offer, and helps you plan a backup, so you can decide with evidence.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/companies" size="lg">
              Explore companies <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/reports" variant="secondary" size="lg">
              Submit a report
            </ButtonLink>
            <ButtonLink href="/dashboard" variant="ghost" size="lg">
              Open dashboard
            </ButtonLink>
          </div>
          <p className="mx-auto mt-5 max-w-md text-xs text-muted">Aagey summarises reports. It does not predict whether any individual offer will be honoured.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-center text-xl font-semibold tracking-tight text-ink sm:text-2xl">Three tools, one place</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {MODULES.map(({ icon: Icon, title, text, href, cta }) => (
            <div key={title} className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{text}</p>
              <Link href={href} className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                {cta} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="flex items-center justify-center gap-2 text-brand-700">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Honest about what the numbers mean</h2>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title}>
                <h3 className="text-sm font-semibold text-ink">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm">
            <Link href="/methodology" className="font-medium text-brand-700 hover:underline">
              Read the full methodology →
            </Link>
          </p>
        </div>
      </section>

      <div className="bg-amber-50">
        <p className="mx-auto max-w-4xl px-4 py-3.5 text-center text-sm text-amber-900 sm:px-6">
          <strong>Demo notice:</strong> some records in this app are synthetic demonstration data. They are always labelled and never counted in scores for real reports.
        </p>
      </div>
    </div>
  );
}
