import { getTestInstance } from '../../../node_modules/better-auth/dist/test-utils/index.mjs';
import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_LINKING_POLICY,
  applySignupReferralToNewUser,
  GOOGLE_OAUTH_SCOPES,
  hasPasswordCredential,
  requireVerifiedGoogleProfile,
} from '../src/auth-policy.js';

const TEST_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';

type GoogleUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
};

async function createAuthTestInstance(initialGoogleUser?: Partial<GoogleUser>) {
  const sentResetEmails: Array<{ email: string; url: string }> = [];
  const passwordAccountEmails = new Set<string>();
  const googleUser: GoogleUser = {
    id: 'google-user-1',
    name: 'Google Student',
    email: 'google@example.com',
    emailVerified: true,
    ...initialGoogleUser,
  };

  const instance = await getTestInstance({
    secret: TEST_SECRET,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const providerRows = passwordAccountEmails.has(user.email)
          ? [{ providerId: 'credential' }]
          : [{ providerId: 'google' }];
        if (hasPasswordCredential(providerRows)) sentResetEmails.push({ email: user.email, url });
      },
    },
    socialProviders: {
      google: {
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        disableDefaultScope: true,
        scope: [...GOOGLE_OAUTH_SCOPES],
        verifyIdToken: async () => true,
        getUserInfo: async () => {
          requireVerifiedGoogleProfile({ email_verified: googleUser.emailVerified });
          return { user: googleUser, data: googleUser };
        },
      },
    },
    account: { accountLinking: { ...ACCOUNT_LINKING_POLICY } },
    databaseHooks: {
      user: {
        create: {
          before: (user, context) => applySignupReferralToNewUser(user, context?.path),
        },
      },
    },
    user: {
      additionalFields: {
        signupReferralCode: {
          type: 'string',
          required: false,
          input: true,
          returned: false,
        },
      },
    },
  }, { disableTestUser: true });

  return { instance, passwordAccountEmails, sentResetEmails };
}

type AuthTestInstance = Awaited<ReturnType<typeof createAuthTestInstance>>['instance'];

async function allRows(
  instance: AuthTestInstance,
  model: 'user' | 'account' | 'session',
) {
  return instance.db.findMany<Record<string, unknown>>({ model });
}

describe('Google and email/password authentication flows', () => {
  it('registers once and reuses the same user on repeat Google sign-in', async () => {
    const { instance } = await createAuthTestInstance();
    const first = await instance.client.signIn.social({
      provider: 'google',
      idToken: { token: 'verified-google-id-token' },
    });
    const second = await instance.client.signIn.social({
      provider: 'google',
      idToken: { token: 'verified-google-id-token' },
    });

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.data).toHaveProperty('user');
    expect(second.data).toHaveProperty('user');
    if (!first.data || !('user' in first.data) || !second.data || !('user' in second.data)) {
      throw new Error('Expected direct Google sign-in user data.');
    }
    expect(second.data.user.id).toBe(first.data.user.id);
    expect(await allRows(instance, 'user')).toHaveLength(1);
    expect(await allRows(instance, 'account')).toHaveLength(1);
  });

  it('rejects a Google identity whose email is not verified', async () => {
    const { instance } = await createAuthTestInstance({ emailVerified: false });
    const result = await instance.client.signIn.social({
      provider: 'google',
      idToken: { token: 'unverified-google-id-token' },
    });

    expect(result.error).toMatchObject({ status: 401 });
    expect(await allRows(instance, 'user')).toHaveLength(0);
    expect(await allRows(instance, 'account')).toHaveLength(0);
  });

  it('registers with email and password, keeps the referral, and signs in again', async () => {
    const { instance } = await createAuthTestInstance();
    const signupPayload: Parameters<typeof instance.client.signUp.email>[0] & { signupReferralCode: string } = {
      name: 'Email Student',
      email: 'email-student@example.com',
      password: 'correct-horse-battery-staple',
      signupReferralCode: '  class-2026  ',
    };
    const signup = await instance.client.signUp.email(signupPayload);

    expect(signup.error).toBeNull();
    expect(signup.data?.token).toEqual(expect.any(String));
    expect(await allRows(instance, 'user')).toEqual([
      expect.objectContaining({
        email: 'email-student@example.com',
        emailVerified: false,
        signupReferralCode: 'class-2026',
      }),
    ]);
    expect(await allRows(instance, 'account')).toEqual([
      expect.objectContaining({ providerId: 'credential' }),
    ]);

    const signin = await instance.client.signIn.email({
      email: 'email-student@example.com',
      password: 'correct-horse-battery-staple',
    });
    expect(signin.error).toBeNull();
    expect(signin.data?.user.email).toBe('email-student@example.com');
  });

  it('rejects invalid credentials and passwords outside the configured range', async () => {
    const { instance } = await createAuthTestInstance();
    const shortPassword = await instance.client.signUp.email({
      name: 'Email Student',
      email: 'email-student@example.com',
      password: 'short',
    });
    const longPassword = await instance.client.signUp.email({
      name: 'Email Student',
      email: 'email-student@example.com',
      password: 'x'.repeat(129),
    });
    expect(shortPassword.error).not.toBeNull();
    expect(longPassword.error).not.toBeNull();

    await instance.client.signUp.email({
      name: 'Email Student',
      email: 'email-student@example.com',
      password: 'correct-horse-battery-staple',
    });
    const signin = await instance.client.signIn.email({
      email: 'email-student@example.com',
      password: 'incorrect-password',
    });
    expect(signin.error).not.toBeNull();
  });

  it('does not implicitly link a Google identity to a password account with the same email', async () => {
    const { instance } = await createAuthTestInstance({ email: 'shared@example.com' });
    const signup = await instance.client.signUp.email({
      name: 'Password Student',
      email: 'shared@example.com',
      password: 'correct-horse-battery-staple',
    });
    expect(signup.error).toBeNull();

    const googleSignin = await instance.client.signIn.social({
      provider: 'google',
      idToken: { token: 'verified-google-id-token' },
    });
    expect(googleSignin.error).not.toBeNull();
    expect(await allRows(instance, 'user')).toHaveLength(1);
    expect(await allRows(instance, 'account')).toEqual([
      expect.objectContaining({ providerId: 'credential' }),
    ]);
  });

  it('does not add a password to an existing Google-only account through sign-up', async () => {
    const { instance } = await createAuthTestInstance({ email: 'shared@example.com' });
    await instance.client.signIn.social({
      provider: 'google',
      idToken: { token: 'verified-google-id-token' },
    });

    const signup = await instance.client.signUp.email({
      name: 'Password Student',
      email: 'shared@example.com',
      password: 'correct-horse-battery-staple',
    });
    expect(signup.error).not.toBeNull();
    expect(await allRows(instance, 'user')).toHaveLength(1);
    expect(await allRows(instance, 'account')).toEqual([
      expect.objectContaining({ providerId: 'google' }),
    ]);
  });

  it('resets a password once, revokes sessions, and invalidates the old password', async () => {
    const { instance, passwordAccountEmails, sentResetEmails } = await createAuthTestInstance();
    await instance.client.signUp.email({
      name: 'Email Student',
      email: 'email-student@example.com',
      password: 'correct-horse-battery-staple',
    });
    passwordAccountEmails.add('email-student@example.com');
    expect((await allRows(instance, 'session')).length).toBeGreaterThan(0);

    const request = await instance.client.requestPasswordReset({
      email: 'email-student@example.com',
      redirectTo: 'http://localhost:3000/reset-password',
    });
    expect(request.error).toBeNull();
    expect(sentResetEmails).toHaveLength(1);
    const resetUrl = new URL(sentResetEmails[0]!.url);
    const token = resetUrl.pathname.split('/').at(-1)!;

    const reset = await instance.client.resetPassword({
      newPassword: 'new-correct-horse-battery-staple',
      token,
    });
    expect(reset.error).toBeNull();
    expect(await allRows(instance, 'session')).toHaveLength(0);

    const oldPassword = await instance.client.signIn.email({
      email: 'email-student@example.com',
      password: 'correct-horse-battery-staple',
    });
    const newPassword = await instance.client.signIn.email({
      email: 'email-student@example.com',
      password: 'new-correct-horse-battery-staple',
    });
    expect(oldPassword.error).not.toBeNull();
    expect(newPassword.error).toBeNull();

    const reusedToken = await instance.client.resetPassword({
      newPassword: 'another-correct-password',
      token,
    });
    expect(reusedToken.error).not.toBeNull();
  });

  it('returns the same reset response without emailing unknown or Google-only users', async () => {
    const { instance, sentResetEmails } = await createAuthTestInstance({ email: 'google-only@example.com' });
    await instance.client.signIn.social({
      provider: 'google',
      idToken: { token: 'verified-google-id-token' },
    });

    const googleOnly = await instance.client.requestPasswordReset({
      email: 'google-only@example.com',
      redirectTo: 'http://localhost:3000/reset-password',
    });
    const unknown = await instance.client.requestPasswordReset({
      email: 'unknown@example.com',
      redirectTo: 'http://localhost:3000/reset-password',
    });

    expect(googleOnly.error).toBeNull();
    expect(unknown.error).toBeNull();
    expect(googleOnly.data?.message).toBe(unknown.data?.message);
    expect(sentResetEmails).toHaveLength(0);
    expect(await allRows(instance, 'account')).toEqual([
      expect.objectContaining({ providerId: 'google' }),
    ]);
  });
});
