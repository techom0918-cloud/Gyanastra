import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:px-6 lg:px-8">
        <p className="max-w-3xl leading-relaxed">
          Aagey summarises community-reported and documented offer outcomes for information only. It does not predict whether any
          individual offer will be honoured, and its scores have not been validated against real-world outcomes.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/methodology" className="hover:text-ink hover:underline">
            Methodology
          </Link>
          <Link href="/reports" className="hover:text-ink hover:underline">
            Submit a report
          </Link>
          <Link href="/mobile" className="hover:text-ink hover:underline">
            Mobile app view
          </Link>
        </nav>
        <p>Aagey · Code2Career National AI Hackathon 2026</p>
      </div>
    </footer>
  );
}
