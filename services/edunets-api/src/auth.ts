import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { db } from '../../../database/index.js';
import { accounts, sessions, users, verifications } from '../../../database/schema/auth.js';
import {
  ACCOUNT_LINKING_POLICY,
  applySignupReferralToNewUser,
  GOOGLE_OAUTH_SCOPES,
  requireVerifiedGoogleProfile,
} from './auth-policy.js';
import { env } from './env.js';

export const auth = betterAuth({
  appName: 'EduNets',
  baseURL: env.betterAuthUrl,
  basePath: '/api/auth',
  secret: env.betterAuthSecret,
  trustedOrigins: env.corsOrigins,
  logger: {
    level: 'warn',
    log: (level) => {
      const entry = JSON.stringify({
        level: level === 'error' ? 'error' : 'warn',
        source: 'better-auth',
        event: 'authentication-subsystem-event',
      });
      if (level === 'error') console.error(entry);
      else console.warn(entry);
    },
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  databaseHooks: {
    user: {
      create: {
        before: (user, context) => applySignupReferralToNewUser(user, context?.path),
      },
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      disableDefaultScope: true,
      scope: [...GOOGLE_OAUTH_SCOPES],
      mapProfileToUser: requireVerifiedGoogleProfile,
    },
  },
  account: {
    accountLinking: {
      ...ACCOUNT_LINKING_POLICY,
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
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.betterAuthUrl.startsWith('https://'),
      path: '/',
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
