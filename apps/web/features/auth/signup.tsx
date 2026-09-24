'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { LoaderCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildAuthPath, getSafeReturnPath } from '@/features/auth/auth-navigation';
import {
  AuthMethodDivider,
  PasswordInput,
  authInputClassName,
  getEmailAuthErrorMessage,
} from '@/features/auth/email-auth';
import { GoogleAuthButton, startGoogleAuth, useOAuthErrorToast } from '@/features/auth/google-auth';
import { InlineMascot } from '@/features/mascot';
import { authClient, getAuthErrorMessage } from '@/lib/api/auth-client';
import { useNavigate, useSearchParams } from '@/lib/navigation';

export default function EduNetsSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnPath(searchParams.get('returnTo'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isEmailPending, setIsEmailPending] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const isPending = isEmailPending || isGooglePending;

  useOAuthErrorToast();

  const validateSignup = () => {
    if (!name.trim()) return 'Enter your name.';
    if (password.length < 8) return 'Password must contain at least 8 characters.';
    if (password.length > 128) return 'Password must contain no more than 128 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    if (referralCode.trim().length > 64) return 'Referral code must be 64 characters or fewer.';
    return null;
  };

  const handleEmailSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    const validationError = validateSignup();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const normalizedReferralCode = referralCode.trim();
    setIsEmailPending(true);
    try {
      const signupPayload: Parameters<typeof authClient.signUp.email>[0] & { signupReferralCode?: string } = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        ...(normalizedReferralCode ? { signupReferralCode: normalizedReferralCode } : {}),
      };
      const result = await authClient.signUp.email(signupPayload);
      if (result.error) throw result.error;
      window.location.replace(returnTo);
    } catch (error) {
      toast.error(getEmailAuthErrorMessage(error, 'EduNets could not create your account. Please try again.'));
      setIsEmailPending(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (isPending) return;
    const normalizedReferralCode = referralCode.trim();
    if (normalizedReferralCode.length > 64) {
      toast.error('Referral code must be 64 characters or fewer.');
      return;
    }

    setIsGooglePending(true);
    try {
      const result = await startGoogleAuth({
        callbackPath: returnTo,
        errorPath: buildAuthPath('/signup', returnTo),
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
  const handleLogin = () => navigate(buildAuthPath('/login', returnTo));

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
          <div className="space-y-5">
            <form className="space-y-4" onSubmit={(event) => void handleEmailSignup(event)}>
              <div>
                <label htmlFor="signup-name" className="mb-2 block text-sm font-bold text-[var(--edunets-dark-blue)]">Name</label>
                <Input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={authInputClassName}
                  placeholder="How should we address you?"
                  required
                  disabled={isPending}
                />
              </div>
              <div>
                <label htmlFor="signup-email" className="mb-2 block text-sm font-bold text-[var(--edunets-dark-blue)]">Email address</label>
                <Input
                  id="signup-email"
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
              <div>
                <label htmlFor="signup-password" className="mb-2 block text-sm font-bold text-[var(--edunets-dark-blue)]">Password</label>
                <PasswordInput
                  id="signup-password"
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
                <label htmlFor="signup-confirm-password" className="mb-2 block text-sm font-bold text-[var(--edunets-dark-blue)]">Confirm password</label>
                <PasswordInput
                  id="signup-confirm-password"
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
              <div>
                <label htmlFor="referral" className="mb-2 block text-sm font-bold text-[var(--edunets-dark-blue)]">Referral code (optional)</label>
                <Input
                  type="text"
                  id="referral"
                  value={referralCode}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setReferralCode(event.target.value)}
                  maxLength={64}
                  autoComplete="off"
                  className={authInputClassName}
                  placeholder="Got a code from a friend?"
                  disabled={isPending}
                />
              </div>
              <Button
                type="submit"
                disabled={isPending || !name.trim() || !email.trim() || !password || !confirmPassword}
                className="h-14 w-full rounded-xl bg-[var(--edunets-dark-blue)] text-base font-black text-white shadow-[0_8px_22px_rgba(29,58,98,0.2)] hover:bg-[var(--edunets-dark-blue)]/90"
              >
                {isEmailPending
                  ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                  : <UserPlus className="h-5 w-5" aria-hidden="true" />}
                {isEmailPending ? 'Creating account…' : 'Create account with email'}
              </Button>
            </form>

            <AuthMethodDivider />

            <GoogleAuthButton
              label="Sign up with Google"
              busy={isGooglePending}
              disabled={isPending}
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
