'use client';

// Form fields: label, hint and error are wired together with aria-describedby / aria-invalid.
// Inputs use 16px text on phones (prevents iOS zoom-on-focus) and 14px from the sm breakpoint.
import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'block w-full rounded-lg border border-line-strong bg-surface px-3.5 text-base text-ink shadow-card sm:text-sm ' +
  'placeholder:text-muted/70 transition-colors hover:border-brand-300 ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 ' +
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:opacity-70 ' +
  'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-100';

interface FieldFrameProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  required?: boolean;
  className?: string;
}

function Frame({
  id,
  label,
  hint,
  error,
  optional,
  required,
  className,
  children,
  trailing,
}: FieldFrameProps & { id: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {required && (
            <span className="ml-0.5 text-red-600" aria-hidden>
              *
            </span>
          )}
          {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
        </label>
        {trailing}
      </div>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint: ReactNode, error?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({
  label,
  hint,
  error,
  optional,
  required,
  className,
  id,
  ...input
}: FieldFrameProps & InputHTMLAttributes<HTMLInputElement>) {
  const uid = useId();
  const inputId = id ?? uid;
  return (
    <Frame id={inputId} {...{ label, hint, error, optional, required, className }}>
      <input
        id={inputId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, hint, error)}
        className={cn(CONTROL, 'h-11')}
        {...input}
      />
    </Frame>
  );
}

export function PasswordField({
  label,
  hint,
  error,
  optional,
  required,
  className,
  id,
  trailing,
  ...input
}: FieldFrameProps & { trailing?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const uid = useId();
  const inputId = id ?? uid;
  const [visible, setVisible] = useState(false);
  return (
    <Frame id={inputId} {...{ label, hint, error, optional, required, className, trailing }}>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, hint, error)}
          className={cn(CONTROL, 'h-11 pr-12')}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted hover:text-ink"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </Frame>
  );
}

export function SelectField({
  label,
  hint,
  error,
  optional,
  required,
  className,
  id,
  children,
  ...select
}: FieldFrameProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const uid = useId();
  const selectId = id ?? uid;
  return (
    <Frame id={selectId} {...{ label, hint, error, optional, required, className }}>
      <select
        id={selectId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(selectId, hint, error)}
        className={cn(CONTROL, 'h-11')}
        {...select}
      >
        {children}
      </select>
    </Frame>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  optional,
  required,
  className,
  id,
  counter,
  ...area
}: FieldFrameProps & { counter?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const uid = useId();
  const areaId = id ?? uid;
  return (
    <Frame
      id={areaId}
      {...{ label, hint, error, optional, required, className }}
      trailing={counter ? <span className="text-xs text-muted tabular-nums">{counter}</span> : undefined}
    >
      <textarea
        id={areaId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(areaId, hint, error)}
        className={cn(CONTROL, 'resize-none py-2.5')}
        {...area}
      />
    </Frame>
  );
}
