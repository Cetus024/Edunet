import { getTestInstance } from '../../../node_modules/better-auth/dist/test-utils/index.mjs';
import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_LINKING_POLICY,
  applySignupReferralToNewUser,
  GOOGLE_OAUTH_SCOPES,
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
  const googleUser: GoogleUser = {
    id: 'google-user-1',
    name: 'Google Student',
    email: 'google@example.com',
    emailVerified: true,
    ...initialGoogleUser,
  };

  const instance = await getTestInstance({
    secret: TEST_SECRET,
    emailAndPassword: { enabled: false },
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

  return instance;
}

async function allRows(
  instance: Awaited<ReturnType<typeof createAuthTestInstance>>,
  model: 'user' | 'account',
) {
  return instance.db.findMany<Record<string, unknown>>({ model });
}

async function postAuthEndpoint(
  instance: Awaited<ReturnType<typeof createAuthTestInstance>>,
  path: '/sign-up/email' | '/sign-in/email',
) {
  return instance.customFetchImpl(`http://localhost:3000/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Email Student',
      email: 'email-student@example.com',
      password: 'correct-horse-battery-staple',
    }),
  });
}

describe('Google-only authentication flow', () => {
  it('registers once and reuses the same user on repeat Google sign-in', async () => {
    const instance = await createAuthTestInstance();
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
    const instance = await createAuthTestInstance({ emailVerified: false });
    const result = await instance.client.signIn.social({
      provider: 'google',
      idToken: { token: 'unverified-google-id-token' },
    });

    expect(result.error).toMatchObject({ status: 401 });
    expect(await allRows(instance, 'user')).toHaveLength(0);
    expect(await allRows(instance, 'account')).toHaveLength(0);
  });

  it('keeps email registration and password login unavailable', async () => {
    const instance = await createAuthTestInstance();
    const signup = await postAuthEndpoint(instance, '/sign-up/email');
    const signin = await postAuthEndpoint(instance, '/sign-in/email');

    expect(signup.status).toBe(400);
    expect(signin.status).toBe(400);
    await expect(signup.json()).resolves.toMatchObject({ code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED' });
    await expect(signin.json()).resolves.toMatchObject({ code: 'EMAIL_PASSWORD_DISABLED' });
    expect(await allRows(instance, 'user')).toHaveLength(0);
  });
});
