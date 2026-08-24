'use client';

import { useState, type ChangeEvent } from 'react';
import { useNavigate } from '@/lib/navigation';
import { toast } from 'sonner';

import { GoogleAuthButton, startGoogleAuth, useOAuthErrorToast } from '@/features/auth/google-auth';
import { InlineMascot } from '@/features/mascot';
import { getAuthErrorMessage } from '@/lib/api/auth-client';

export default function EduNetsSignup() {
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState('');
  const [isGooglePending, setIsGooglePending] = useState(false);

  useOAuthErrorToast();

  const handleGoogleSignup = async () => {
    const normalizedReferralCode = referralCode.trim();
    if (normalizedReferralCode.length > 64) {
      toast.error('Referral code must be 64 characters or fewer.');
      return;
    }

    setIsGooglePending(true);
    try {
      const result = await startGoogleAuth({
        errorPath: '/signup',
        ...(normalizedReferralCode ? { signupReferralCode: normalizedReferralCode } : {}),
      });
      if (result.error) throw result.error;
    } catch (error) {
      toast.error(getAuthErrorMessage(
        error,
        'EduNets could not start Google sign-up. Please try again.',
      ));
      setIsGooglePending(false);
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
          <div className="space-y-6">
            <div>
              <label htmlFor="referral" className="mb-2 block text-sm font-medium text-[var(--edunets-dark-blue)]">Referral code (optional)</label>
              <input type="text" id="referral" value={referralCode} onChange={(e: ChangeEvent<HTMLInputElement>) => setReferralCode(e.target.value)}
                maxLength={64}
                className="w-full rounded-2xl border border-[var(--edunets-light-blue)] px-4 py-3 outline-none transition-colors focus:border-[var(--edunets-light-blue)] focus:ring-2 focus:ring-[var(--edunets-light-blue)]"
                placeholder="Got a code from a friend?" />
            </div>
            <GoogleAuthButton
              label="Sign up with Google"
              busy={isGooglePending}
              disabled={isGooglePending}
              onClick={() => void handleGoogleSignup()}
            />
            <div className="text-center">
              <span className="text-[var(--edunets-dark-blue)]">Already have an account? </span>
              <button type="button" onClick={handleLogin} className="font-semibold text-[var(--edunets-dark-blue)] transition-colors hover:text-[var(--edunets-light-blue)]">Log In</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
