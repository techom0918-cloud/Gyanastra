import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode, Ref } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-card',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-brand-50 hover:border-brand-300',
  ghost: 'text-ink-soft hover:bg-brand-50 hover:text-ink',
  danger: 'border border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
};

// Touch targets are 44px tall on phones (h-11) and a little denser from the sm breakpoint up.
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-10 px-3 text-sm sm:h-9',
  md: 'h-11 px-4 text-sm sm:h-10',
  lg: 'h-12 px-5 text-base',
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } = {}) {
  return cn(
    'inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant, size, fullWidth, loading, className, children, disabled, type = 'button', ref, ...rest }: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

export function ButtonLink({ variant, size, fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest} />;
}
