import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_LINKING_POLICY,
  applySignupReferralToNewUser,
  GOOGLE_OAUTH_SCOPES,
  requireVerifiedGoogleProfile,
} from '../src/auth-policy.js';

describe('authentication policy', () => {
  it('keeps Google scopes and safe implicit-linking rules explicit', () => {
    expect(GOOGLE_OAUTH_SCOPES).toEqual(['openid', 'email', 'profile']);
    expect(ACCOUNT_LINKING_POLICY).toEqual({
      enabled: true,
      disableImplicitLinking: false,
      requireLocalEmailVerified: true,
      allowDifferentEmails: false,
      updateUserInfoOnLink: false,
    });
  });

  it('requires the verified-email claim from Google', () => {
    expect(requireVerifiedGoogleProfile({ email_verified: true })).toEqual({});
    expect(() => requireVerifiedGoogleProfile({ email_verified: false })).toThrowError();
    expect(() => requireVerifiedGoogleProfile({})).toThrowError();
  });

  it('normalizes referral data before first user creation and rejects oversized values', async () => {
    await expect(applySignupReferralToNewUser({
      email: 'student@example.com',
      signupReferralCode: '  class-2026  ',
    }, '/sign-in/social')).resolves.toEqual({
      data: {
        email: 'student@example.com',
        signupReferralCode: 'class-2026',
      },
    });

    await expect(applySignupReferralToNewUser({
      signupReferralCode: 'x'.repeat(65),
    }, '/sign-in/social')).rejects.toMatchObject({
      body: { code: 'INVALID_REFERRAL_CODE' },
    });

    await expect(applySignupReferralToNewUser(
      { email: 'google-student@example.com' },
      '/callback/:id',
      async () => ({ signupReferralCode: '  google-class  ' }),
    )).resolves.toEqual({
      data: {
        email: 'google-student@example.com',
        signupReferralCode: 'google-class',
      },
    });
  });
});
