'use client';

import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, LoaderCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildAuthPath, getSafeReturnPath } from '@/features/auth/auth-navigation';
import { authInputClassName, getEmailAuthErrorMessage } from '@/features/auth/email-auth';
import { browserUrl } from '@/features/auth/google-auth';
import { authClient } from '@/lib/api/auth-client';
import { useNavigate, useSearchParams } from '@/lib/navigation';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnPath(searchParams.get('returnTo'));
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    const normalizedEmail = email.trim().toLowerCase();
    const resetParams = new URLSearchParams({ returnTo });

    setIsPending(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: normalizedEmail,
        redirectTo: browserUrl(`/reset-password?${resetParams.toString()}`),
      });
      if (result.error) throw result.error;
      setSubmittedEmail(normalizedEmail);
    } catch (error) {
      toast.error(getEmailAuthErrorMessage(error, 'EduNets could not start password recovery. Please try again.'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(115deg,#eaf2ff_0%,#f7f4e7_50%,#fff8dc_100%)] p-5 text-[var(--edunets-ink)]">
      <section className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-7 shadow-[0_26px_70px_rgba(29,58,98,0.14)] sm:p-10">
        {submittedEmail ? (
          <div className="text-center" aria-live="polite">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-3xl font-black text-[var(--edunets-dark-blue)]">Check your email</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              If a password account exists for <strong>{submittedEmail}</strong>, we sent a one-time reset link. The link expires in 1 hour.
            </p>
            <Button
              type="button"
              onClick={() => navigate(buildAuthPath('/login', returnTo), { replace: true })}
              className="mt-7 h-12 w-full rounded-xl bg-[var(--edunets-dark-blue)] font-black text-white"
            >
              Back to login
            </Button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => navigate(buildAuthPath('/login', returnTo))}
              className="inline-flex items-center gap-2 text-sm font-black text-[var(--edunets-dark-blue)] hover:text-[var(--edunets-light-blue)] focus-visible:outline-none focus-visible:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to login
            </button>
            <span className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[var(--edunets-dark-blue)]">
              <Mail className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-3xl font-black text-[var(--edunets-dark-blue)]">Forgot your password?</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              Enter the email used by your password account. For privacy, the confirmation is the same even if no matching password account exists.
            </p>
            <form className="mt-7 space-y-5" onSubmit={(event) => void handleSubmit(event)}>
              <div>
                <label htmlFor="recovery-email" className="mb-2 block text-sm font-bold text-[var(--edunets-dark-blue)]">Email address</label>
                <Input
                  id="recovery-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={authInputClassName}
                  placeholder="you@example.com"
                  required
                  disabled={isPending}
                />
              </div>
              <Button
                type="submit"
                disabled={isPending || !email.trim()}
                className="h-12 w-full rounded-xl bg-[var(--edunets-dark-blue)] font-black text-white"
              >
                {isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isPending ? 'Sending reset link…' : 'Send reset link'}
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
