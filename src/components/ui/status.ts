// Semantic styling for offer statuses. Colour is never the only signal: every status also has an icon and a label.
// Class names are written out in full so Tailwind can see them.
import { CircleCheck, CircleX, Clock, Hourglass, MailCheck, type LucideIcon } from 'lucide-react';
import { OfferStatus } from '@/types';

export interface StatusStyle {
  icon: LucideIcon;
  /** Soft pill: background, text and ring. */
  badge: string;
  /** Solid colour for bars and dots. */
  solid: string;
  /** Selected state for radio cards. */
  selected: string;
}

export const STATUS_STYLES: Record<OfferStatus, StatusStyle> = {
  offer_received: {
    icon: MailCheck,
    badge: 'bg-brand-50 text-brand-700 ring-brand-200',
    solid: 'bg-brand-500',
    selected: 'border-brand-500 bg-brand-50 text-brand-700 ring-brand-500',
  },
  bg_verification_pending: {
    icon: Hourglass,
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    solid: 'bg-amber-500',
    selected: 'border-amber-500 bg-amber-50 text-amber-800 ring-amber-500',
  },
  joining_confirmed: {
    icon: CircleCheck,
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    solid: 'bg-emerald-500',
    selected: 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-emerald-500',
  },
  joining_delayed: {
    icon: Clock,
    badge: 'bg-orange-50 text-orange-800 ring-orange-200',
    solid: 'bg-orange-500',
    selected: 'border-orange-500 bg-orange-50 text-orange-800 ring-orange-500',
  },
  offer_revoked: {
    icon: CircleX,
    badge: 'bg-red-50 text-red-800 ring-red-200',
    solid: 'bg-red-500',
    selected: 'border-red-500 bg-red-50 text-red-800 ring-red-500',
  },
};
