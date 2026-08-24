'use client';

import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

import {
  GoogleAuthButton,
  startGoogleAuth,
  useOAuthErrorToast,
} from '@/features/auth/google-auth';
import { getAuthErrorMessage } from '@/lib/api/auth-client';
import { useNavigate } from '@/lib/navigation';

export default function EduNetsLogin() {
  const navigate = useNavigate();
  const [isGooglePending, setIsGooglePending] = useState(false);

  useOAuthErrorToast();

  const handleGoogleLogin = async () => {
    setIsGooglePending(true);
    try {
      const result = await startGoogleAuth({ errorPath: '/login' });
      if (result.error) throw result.error;
    } catch (error) {
      toast.error(getAuthErrorMessage(
        error,
        'EduNets could not start Google sign-in. Please try again.',
      ));
      setIsGooglePending(false);
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
            <Image
              src="/branding/edunets-logo.png"
              alt="EduNets"
              width={881}
              height={459}
              className="h-20 w-auto select-none sm:h-24"
            />

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

            <div className="mt-9 space-y-6">
              <GoogleAuthButton
                label="Continue with Google"
                busy={isGooglePending}
                disabled={isGooglePending}
                onClick={() => void handleGoogleLogin()}
              />

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
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
