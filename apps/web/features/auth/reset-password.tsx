'use client';

import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { buildAuthPath, getSafeReturnPath } from '@/features/auth/auth-navigation';
import { PasswordInput, getEmailAuthErrorMessage } from '@/features/auth/email-auth';
import { authClient } from '@/lib/api/auth-client';
import { useNavigate, useSearchParams } from '@/lib/navigation';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnPath(searchParams.get('returnTo'));
  const token = searchParams.get('token');
  const invalidLink = searchParams.has('error') || !token;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || isPending) return;
    if (password.length < 8) {
      toast.error('Password must contain at least 8 characters.');
      return;
    }
    if (password.length > 128) {
      toast.error('Password must contain no more than 128 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw result.error;
      setIsComplete(true);
    } catch (error) {
      toast.error(getEmailAuthErrorMessage(error, 'EduNets could not reset your password. Request a new link and try again.'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(115deg,#eaf2ff_0%,#f7f4e7_50%,#fff8dc_100%)] p-5 text-[var(--edunets-ink)]">
      <section className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-7 shadow-[0_26px_70px_rgba(29,58,98,0.14)] sm:p-10">
        {invalidLink ? (
          <div className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <AlertCircle className="h-8 w-8" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-3xl font-black text-[var(--edunets-dark-blue)]">Reset link unavailable</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">This password reset link is invalid, expired, or has already been used.</p>
            <Button
              type="button"
              onClick={() => navigate(buildAuthPath('/forgot-password', returnTo), { replace: true })}
              className="mt-7 h-12 w-full rounded-xl bg-[var(--edunets-dark-blue)] font-black text-white"
            >
              Request a new link
            </Button>
          </div>
        ) : isComplete ? (
          <div className="text-center" aria-live="polite">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-3xl font-black text-[var(--edunets-dark-blue)]">Password updated</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">Your old sessions have been signed out. Log in again with your new password.</p>
            <Button
              type="button"
              onClick={() => navigate(buildAuthPath('/login', returnTo), { replace: true })}
              className="mt-7 h-12 w-full rounded-xl bg-[var(--edunets-dark-blue)] font-black text-white"
            >
              Continue to login
            </Button>
          </div>
        ) : (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[var(--edunets-dark-blue)]">
              <KeyRound className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-3xl font-black text-[var(--edunets-dark-blue)]">Choose a new password</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">Use between 8 and 128 characters. This one-time link stops working after your password changes.</p>
            <form className="mt-7 space-y-5" onSubmit={(event) => void handleSubmit(event)}>
              <div>
                <label htmlFor="new-password" className="mb-2 block text-sm font-bold text-[var(--edunets-dark-blue)]">New password</label>
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="8–128 characters"
                  required
                  disabled={isPending}
                />
              </div>
              <div>
                <label htmlFor="confirm-new-password" className="mb-2 block text-sm font-bold text-[var(--edunets-dark-blue)]">Confirm new password</label>
                <PasswordInput
                  id="confirm-new-password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Enter the same password again"
                  required
                  disabled={isPending}
                />
              </div>
              <Button
                type="submit"
                disabled={isPending || !password || !confirmPassword}
                className="h-12 w-full rounded-xl bg-[var(--edunets-dark-blue)] font-black text-white"
              >
                {isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isPending ? 'Updating password…' : 'Update password'}
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
