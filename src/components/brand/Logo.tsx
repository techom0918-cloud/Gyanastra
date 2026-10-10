// The official Aagey logo (wordmark + upward arrow + tagline), served locally from /public/aagey-logo.jpeg.
// The image is never redrawn or recoloured. Its height is set and the width follows the real aspect ratio
// (302 × 94), so it cannot be distorted. The source is small, so sizes stay modest.
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export const LOGO_SRC = '/aagey-logo.jpeg';
export const LOGO_WIDTH = 302;
export const LOGO_HEIGHT = 94;
export const TAGLINE = 'From Uncertainty to Your Next Opportunity';
export const LOGO_ALT = 'Aagey — From Uncertainty to Your Next Opportunity';

const HEIGHTS = {
  /** Compact mobile app bar. */
  sm: 'h-9',
  /** Desktop header. */
  md: 'h-10 sm:h-11',
  /** Footers and small cards. */
  lg: 'h-14',
  /** Login / signup / homepage hero. */
  xl: 'h-16 sm:h-20',
} as const;

export type LogoSize = keyof typeof HEIGHTS;

export function Logo({ size = 'md', priority = false, className }: { size?: LogoSize; priority?: boolean; className?: string }) {
  return (
    // The JPEG carries its own light-blue backdrop, so it is shown as a rounded tile instead of being cut out.
    <span className={cn('inline-flex shrink-0 overflow-hidden rounded-lg bg-brand-50 ring-1 ring-brand-200/70', className)}>
      <Image
        src={LOGO_SRC}
        alt={LOGO_ALT}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority={priority}
        unoptimized
        className={cn('w-auto object-contain', HEIGHTS[size])}
      />
    </span>
  );
}

/** The logo as a link to the homepage (or another target). */
export function LogoLink({ href = '/', ...props }: { href?: string } & Parameters<typeof Logo>[0]) {
  return (
    <Link href={href} className="inline-flex rounded-lg" aria-label="Aagey home">
      <Logo {...props} />
    </Link>
  );
}
