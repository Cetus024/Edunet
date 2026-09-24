'use client';

import { useEffect, type ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';

import { authClient } from '@/lib/api/auth-client';

type GoogleAuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  label: string;
};

export function browserUrl(path: string): string {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error('Authentication redirects must stay on EduNets.');
  return url.toString();
}

export async function startGoogleAuth(options: {
  errorPath: string;
  callbackPath?: string;
  signupReferralCode?: string;
}) {
  const callbackPath = options.callbackPath ?? '/onboarding';
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: browserUrl(callbackPath),
    newUserCallbackURL: browserUrl(callbackPath),
    errorCallbackURL: browserUrl(options.errorPath),
    ...(options.signupReferralCode
      ? { additionalData: { signupReferralCode: options.signupReferralCode } }
      : {}),
  });
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Google sign-in was cancelled.',
  account_not_linked: 'An account already exists for this email. Use the original sign-in method.',
  email_not_verified: 'Google could not confirm this email address.',
  oauth_callback_error: 'Google sign-in could not be completed. Please try again.',
};

export function useOAuthErrorToast(): void {
  useEffect(() => {
    const url = new URL(window.location.href);
    const error = url.searchParams.get('error');
    if (!error) return;

    toast.error(OAUTH_ERROR_MESSAGES[error.toLowerCase()]
      ?? 'Google sign-in could not be completed. Please try again.');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);
}

export function GoogleAuthButton({ busy = false, disabled, label, ...props }: GoogleAuthButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy}
      className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-[#cbd7e6] bg-white px-5 text-base font-black text-[var(--edunets-dark-blue)] shadow-[0_4px_14px_rgba(29,58,98,0.08)] transition-all hover:-translate-y-0.5 hover:bg-[#f8fbff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      {...props}
    >
      {busy ? (
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.42l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.39 13.87A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.51H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.49l3.35-2.62Z" />
          <path fill="#EA4335" d="M12 6c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.62C7.18 7.76 9.39 6 12 6Z" />
        </svg>
      )}
      <span>{busy ? 'Opening Google…' : label}</span>
    </button>
  );
}
