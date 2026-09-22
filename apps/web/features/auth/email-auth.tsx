'use client';

import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { getAuthErrorCode, getAuthErrorMessage } from '@/lib/api/auth-client';
import { cn } from '@/lib/utils';

export const authInputClassName = 'h-12 rounded-xl border-[#cbd7e6] bg-white px-4 text-base text-[var(--edunets-ink)] shadow-sm focus-visible:border-[var(--edunets-light-blue)] focus-visible:ring-[var(--edunets-light-blue)]/25';

const EMAIL_AUTH_ERRORS: Record<string, string> = {
  INVALID_EMAIL: 'Enter a valid email address.',
  INVALID_EMAIL_OR_PASSWORD: 'Email or password is incorrect.',
  PASSWORD_TOO_SHORT: 'Password must contain at least 8 characters.',
  PASSWORD_TOO_LONG: 'Password must contain no more than 128 characters.',
  USER_ALREADY_EXISTS: 'An account already exists for this email. Use the original sign-in method.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account already exists for this email. Use the original sign-in method.',
  INVALID_TOKEN: 'This password reset link is invalid or has expired.',
};

export function getEmailAuthErrorMessage(error: unknown, fallback: string): string {
  const code = getAuthErrorCode(error);
  return code && EMAIL_AUTH_ERRORS[code]
    ? EMAIL_AUTH_ERRORS[code]
    : getAuthErrorMessage(error, fallback);
}

export function AuthMethodDivider() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">or</span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        className={cn(authInputClassName, 'pr-12', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-[var(--edunets-dark-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)]"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
