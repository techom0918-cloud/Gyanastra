'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Shield, Menu, X } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/companies', label: 'Companies' },
  { href: '/reports', label: 'Submit Report' },
  { href: '/tracker', label: 'Track Offer' },
  { href: '/backup-planner', label: 'Backup Planner' },
  { href: '/methodology', label: 'Methodology' },
];

function NavbarInner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900">
            <Shield className="w-6 h-6 text-blue-600" />
            <span>Aagey<span className="text-blue-600"> AI</span></span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href || pathname?.startsWith(item.href + '/')
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  pathname === item.href
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

export default function Navbar() {
  return (
    <Suspense
      fallback={
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center">
              <span className="flex items-center gap-2 font-bold text-lg text-gray-900">
                <Shield className="w-6 h-6 text-blue-600" />
                <span>Aagey<span className="text-blue-600"> AI</span></span>
              </span>
            </div>
          </div>
        </nav>
      }
    >
      <NavbarInner />
    </Suspense>
  );
}
