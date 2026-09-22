import { APIError, getOAuthState } from 'better-auth/api';

import { signupReferralCodeSchema } from './validation.js';

export const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'] as const;

export const ACCOUNT_LINKING_POLICY = {
  enabled: true,
  disableImplicitLinking: false,
  requireLocalEmailVerified: true,
  allowDifferentEmails: false,
  updateUserInfoOnLink: false,
} as const;

export function requireVerifiedGoogleProfile(
  profile: { email_verified?: boolean },
): Record<string, never> {
  if (profile.email_verified !== true) {
    throw new APIError('UNAUTHORIZED', {
      code: 'GOOGLE_EMAIL_NOT_VERIFIED',
      message: 'Google could not verify this email address.',
    });
  }

  return {};
}

export async function applySignupReferralToNewUser<T extends Record<string, unknown>>(
  user: T,
  contextPath?: string,
  readOAuthState: () => Promise<{ signupReferralCode?: unknown } | null> = async () => (
    await getOAuthState() as ({ signupReferralCode?: unknown } | null)
  ),
): Promise<{ data: T } | undefined> {
  const rawReferralCode = contextPath === '/callback/:id'
    ? (await readOAuthState() as ({ signupReferralCode?: unknown } | null))
      ?.signupReferralCode
    : user.signupReferralCode;
  if (rawReferralCode === undefined || rawReferralCode === null) return;

  const referralCode = signupReferralCodeSchema.safeParse(rawReferralCode);
  if (!referralCode.success) {
    throw new APIError('BAD_REQUEST', {
      code: 'INVALID_REFERRAL_CODE',
      message: 'Referral code is invalid.',
    });
  }

  return {
    data: {
      ...user,
      signupReferralCode: referralCode.data || undefined,
    },
  };
}
