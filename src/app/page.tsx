import Link from 'next/link';
import { Shield, BarChart3, Brain, Bell } from 'lucide-react';

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Offer Reliability Tracker',
    desc: 'See community-reported offer outcomes, status distributions, and a transparent reliability indicator for companies.',
    href: '/companies',
    cta: 'Explore Companies',
  },
  {
    icon: Brain,
    title: 'AI Backup Career Planner',
    desc: 'Get a personalised backup plan with actionable steps, skill recommendations, and job-search strategy tailored to your situation.',
    href: '/backup-planner',
    cta: 'Generate Plan',
  },
  {
    icon: Bell,
    title: 'Offer Status Watchdog',
    desc: 'Track your own offer, compare with community reports, and receive alerts when relevant trends emerge.',
    href: '/tracker',
    cta: 'Track Your Offer',
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-5xl mx-auto px-4 py-20 sm:py-28 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
              <Shield className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Aagey <span className="text-blue-200">AI</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
            Campus placement offer uncertainty is real. Make informed career decisions with community-reported data, transparent reliability indicators, and AI-powered backup planning.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
            >
              Open Dashboard
            </Link>
            <Link
              href="/reports"
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-500/30 text-white font-semibold rounded-xl hover:bg-blue-500/40 transition-colors border border-white/20"
            >
              Submit a Report
            </Link>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-4">The Problem</h2>
        <p className="text-gray-600 text-center max-w-2xl mx-auto leading-relaxed">
          Every year, thousands of students receive campus placement offers but face delayed joining dates, unclear timelines, or even offer revocations. They stop applying elsewhere and lose valuable preparation time — with no way to gauge what is likely to happen.
        </p>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">Three Modules, One Platform</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="bg-blue-50 rounded-xl w-12 h-12 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{f.desc}</p>
                <Link href={f.href} className="text-blue-600 text-sm font-medium hover:underline">
                  {f.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Built on Transparency</h2>
        <div className="grid sm:grid-cols-3 gap-6 text-sm text-gray-600">
          <div className="p-4">
            <p className="font-semibold text-gray-900 mb-1">Open Methodology</p>
            <p>Every indicator uses a documented formula with visible inputs. No black-box scores.</p>
          </div>
          <div className="p-4">
            <p className="font-semibold text-gray-900 mb-1">Honest Limitations</p>
            <p>We label community data, flag small samples, and never equate absence of reports with reliability.</p>
          </div>
          <div className="p-4">
            <p className="font-semibold text-gray-900 mb-1">Privacy First</p>
            <p>No offer letters, personal identifiers, or confidential recruiter communications are stored.</p>
          </div>
        </div>
      </section>

      {/* Demo banner */}
      <section className="bg-amber-50 border-t border-amber-200">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-sm text-amber-800">
          <strong>Demo Mode:</strong> This application uses demonstration seed data. All reports shown are clearly labelled as demo data.
        </div>
      </section>
    </div>
  );
}
