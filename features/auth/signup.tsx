'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@/lib/navigation';
import { toast } from 'sonner';

import { InlineMascot } from '@/features/mascot';
import { authClient, getAuthErrorMessage } from '@/lib/api/auth-client';
import { currentAccountQueryKey, getCurrentAccount } from '@/lib/api/me';

export default function EduNetsSignup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim();
    const normalizedReferralCode = referralCode.trim();

    if (!normalizedName || !normalizedEmail || !password.trim()) {
      toast.error('Add your full name, email and password to create an account.');
      return;
    }

    setIsSubmitting(true);
    try {
      type SignupInput = Parameters<typeof authClient.signUp.email>[0] & {
        signupReferralCode?: string;
      };
      const signupInput = {
        name: normalizedName,
        email: normalizedEmail,
        password,
        ...(normalizedReferralCode
          ? { signupReferralCode: normalizedReferralCode }
          : {}),
      } as SignupInput;

      const result = await authClient.signUp.email(signupInput);
      if (result.error) {
        toast.error(
          getAuthErrorMessage(
            result.error,
            'EduNets could not create this account. Please check your details.',
          ),
        );
        return;
      }

      const account = await getCurrentAccount();
      if (!account) {
        throw new Error('The new account session could not be confirmed. Please log in.');
      }

      queryClient.setQueryData(currentAccountQueryKey, account);
      toast.success(
        normalizedReferralCode
          ? 'Account created with referral code.'
          : 'Account created.',
      );
      navigate(account.onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
    } catch (error) {
      toast.error(
        getAuthErrorMessage(
          error,
          'EduNets could not create your account. Please try again.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleLogin = () => navigate('/login');

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Left: gradient wash panel */}
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-[var(--edunets-yellow)] to-[var(--edunets-light-blue)] p-8 md:p-12">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight text-[var(--edunets-dark-blue)] md:text-5xl">
            12 minutes today beats 12 hours the night before finals.
          </h1>
          <p className="mt-4 text-lg text-[var(--edunets-dark-blue)]">
            EduNets tracks what you're forgetting before it costs you the exam.
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-1 items-center justify-center bg-card p-8 text-card-foreground md:p-12">
        <div className="w-full max-w-md">
          <InlineMascot
            scene="growth"
            message="Let’s grow your study network together."
            className="mb-8"
          />
          <div className="mb-8">
            <h2 className="mb-2 text-3xl font-bold text-[var(--edunets-dark-blue)]">Join EduNets</h2>
            <p className="text-[var(--edunets-light-blue)]">Start remembering what you study — not just reviewing it.</p>
          </div>
          <form className="space-y-6" onSubmit={handleCreateAccount}>
            <div>
              <label htmlFor="full-name" className="mb-2 block text-sm font-medium text-[var(--edunets-dark-blue)]">Full name</label>
              <input type="text" id="full-name" value={fullName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                autoComplete="name"
                className="w-full rounded-2xl border border-[var(--edunets-light-blue)] px-4 py-3 outline-none transition-colors focus:border-[var(--edunets-light-blue)] focus:ring-2 focus:ring-[var(--edunets-light-blue)]"
                placeholder="Enter your full name" />
            </div>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-[var(--edunets-dark-blue)]">Your email</label>
              <input type="email" id="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-2xl border border-[var(--edunets-light-blue)] px-4 py-3 outline-none transition-colors focus:border-[var(--edunets-light-blue)] focus:ring-2 focus:ring-[var(--edunets-light-blue)]"
                placeholder="you@school.edu" />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-[var(--edunets-dark-blue)]">Create password</label>
              <input type="password" id="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-2xl border border-[var(--edunets-light-blue)] px-4 py-3 outline-none transition-colors focus:border-[var(--edunets-light-blue)] focus:ring-2 focus:ring-[var(--edunets-light-blue)]"
                placeholder="Enter your password" />
            </div>
            <div>
              <label htmlFor="referral" className="mb-2 block text-sm font-medium text-[var(--edunets-dark-blue)]">Referral code (optional)</label>
              <input type="text" id="referral" value={referralCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferralCode(e.target.value)}
                className="w-full rounded-2xl border border-[var(--edunets-light-blue)] px-4 py-3 outline-none transition-colors focus:border-[var(--edunets-light-blue)] focus:ring-2 focus:ring-[var(--edunets-light-blue)]"
                placeholder="Got a code from a friend?" />
            </div>
            <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}
              className="w-full rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
              {isSubmitting ? 'Creating Account…' : 'Create My Account'}
            </button>
            <div className="text-center">
              <span className="text-[var(--edunets-dark-blue)]">Already have an account? </span>
              <button type="button" onClick={handleLogin} className="font-semibold text-[var(--edunets-dark-blue)] transition-colors hover:text-[var(--edunets-light-blue)]">Log In</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
