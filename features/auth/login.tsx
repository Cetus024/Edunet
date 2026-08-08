'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Brain, Check, LockKeyhole, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { authClient, getAuthErrorMessage } from '@/lib/api/auth-client';
import { currentAccountQueryKey, getCurrentAccount } from '@/lib/api/me';
import { DEMO_LOGIN_OPTIONS } from '@/lib/demo-auth';
import { useNavigate } from '@/lib/navigation';
import { getAuthenticatedHome } from '@/lib/roles';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EduNetsLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password.trim()) {
      toast.error('Add your email and password to log in.');
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      toast.error('Enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authClient.signIn.email({
        email: normalizedEmail,
        password,
      });
      if (result.error) {
        toast.error(
          getAuthErrorMessage(result.error, 'Email or password is incorrect.'),
        );
        return;
      }

      const account = await getCurrentAccount();
      if (!account) {
        throw new Error('The account session could not be confirmed. Please try again.');
      }

      queryClient.setQueryData(currentAccountQueryKey, account);
      toast.success('Welcome back to EduNets.');
      navigate(
        account.onboardingCompleted
          ? getAuthenticatedHome(account.profile?.role)
          : '/onboarding',
        { replace: true },
      );
    } catch (error) {
      toast.error(
        getAuthErrorMessage(error, 'EduNets could not log you in. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(115deg,#eaf2ff_0%,#f7f4e7_50%,#fff8dc_100%)] text-[var(--edunets-ink)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-12 h-96 w-96 rounded-full bg-[var(--edunets-light-blue)]/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-[var(--edunets-yellow)]/45 blur-3xl"
      />

      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute right-4 top-4 z-30 inline-flex h-12 items-center gap-2 rounded-xl border border-white/80 bg-white/90 px-4 text-sm font-bold text-[var(--edunets-dark-blue)] shadow-[0_10px_28px_rgba(29,58,98,0.12)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] focus-visible:ring-offset-2 sm:right-7 sm:top-6 sm:h-14 sm:px-5 sm:text-base"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        Back to Home
      </button>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        <section className="order-2 flex items-center justify-center px-6 pb-14 pt-10 sm:px-10 lg:order-1 lg:px-14 lg:py-20 xl:px-20">
          <div className="w-full max-w-xl">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-[var(--edunets-light-blue)] to-[var(--edunets-yellow)] text-white shadow-[0_14px_32px_rgba(29,58,98,0.18)] sm:h-20 sm:w-20">
                <Brain className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
              </div>
              <span className="text-3xl font-black tracking-tight text-[var(--edunets-dark-blue)] sm:text-4xl">
                EduNets
              </span>
            </div>

            <h1 className="mt-10 text-4xl font-black leading-tight tracking-tight text-[var(--edunets-dark-blue)] sm:text-5xl">
              Continue Your Learning
            </h1>
            <p className="mt-6 max-w-lg text-base font-medium leading-8 text-[var(--edunets-ink)]/70 sm:text-lg">
              Log in to review your subjects, track your progress, and continue from where you stopped.
            </p>

            <ul className="mt-9 space-y-4" aria-label="EduNets learning features">
              {[
                'Adaptive learning algorithm',
                'Short daily revision sessions',
                'Track all your subjects',
                'Built for O-Level revision',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm font-bold text-[var(--edunets-ink)] sm:text-base">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--edunets-light-blue)] to-[#d1b64e] text-white shadow-sm">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="order-1 flex items-center justify-center px-4 pb-8 pt-24 sm:px-8 sm:pb-10 sm:pt-28 lg:order-2 lg:px-12 lg:py-24">
          <div className="w-full max-w-[560px] rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_26px_70px_rgba(29,58,98,0.14)] sm:p-10 lg:p-12">
            <div className="text-center">
              <h2 className="text-3xl font-black tracking-tight text-[var(--edunets-dark-blue)] sm:text-4xl">
                Welcome Back
              </h2>
              <p className="mt-3 text-sm font-medium text-[var(--edunets-light-blue)] sm:text-base">
                Log in to continue your revision
              </p>
            </div>

            <form className="mt-9 space-y-6" onSubmit={handleLogin} noValidate>
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-sm font-bold text-[var(--edunets-dark-blue)]"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--edunets-light-blue)]/70"
                    aria-hidden="true"
                  />
                  <input
                    type="email"
                    id="login-email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="h-14 w-full rounded-xl border border-[#cbd7e6] bg-white pl-12 pr-4 text-base text-[var(--edunets-ink)] shadow-[0_2px_7px_rgba(29,58,98,0.08)] outline-none transition-all placeholder:text-[#a8b5c8] focus:border-[var(--edunets-light-blue)] focus:ring-2 focus:ring-[var(--edunets-light-blue)]/25"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block text-sm font-bold text-[var(--edunets-dark-blue)]"
                >
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--edunets-light-blue)]/70"
                    aria-hidden="true"
                  />
                  <input
                    type="password"
                    id="login-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    className="h-14 w-full rounded-xl border border-[#cbd7e6] bg-white pl-12 pr-4 text-base text-[var(--edunets-ink)] shadow-[0_2px_7px_rgba(29,58,98,0.08)] outline-none transition-all placeholder:text-[#a8b5c8] focus:border-[var(--edunets-light-blue)] focus:ring-2 focus:ring-[var(--edunets-light-blue)]/25"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="group flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#3f6fbe] via-[#5c718e] to-[#876512] px-5 text-base font-black text-white shadow-[0_12px_28px_rgba(63,111,190,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(63,111,190,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {isSubmitting ? 'Logging In…' : 'Log In'}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </button>

              <p className="text-center text-sm font-medium text-[var(--edunets-ink)]/65 sm:text-base">
                Don’t have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="font-black text-[var(--edunets-dark-blue)] transition-colors hover:text-[var(--edunets-light-blue)] focus-visible:outline-none focus-visible:underline"
                >
                  Create Account
                </button>
              </p>

              <div className="rounded-2xl border border-[#d7e0eb] bg-[#f7f9fc] p-4 text-left">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--edunets-light-blue)]">
                  Demo accounts
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {DEMO_LOGIN_OPTIONS.map((option) => (
                    <button
                      key={option.email}
                      type="button"
                      onClick={() => {
                        setEmail(option.email);
                        setPassword(option.password);
                      }}
                      className="rounded-xl border border-[#cbd7e6] bg-white px-3 py-2 text-left text-xs font-bold text-[var(--edunets-dark-blue)] transition hover:border-[var(--edunets-light-blue)] hover:bg-[#eef4fb]"
                    >
                      <span className="block">{option.label}</span>
                      <span className="mt-1 block font-medium text-[var(--edunets-ink)]/60">
                        {option.email}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs font-semibold text-[var(--edunets-ink)]/60">
                  Password: EduNets2026!
                </p>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
