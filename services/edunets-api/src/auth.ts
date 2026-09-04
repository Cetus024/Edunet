import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../database/index.js';
import { accounts, sessions, users, verifications } from '../../../database/schema/auth.js';
import {
  ACCOUNT_LINKING_POLICY,
  applySignupReferralToNewUser,
  CREDENTIAL_PROVIDER_ID,
  GOOGLE_OAUTH_SCOPES,
  requireVerifiedGoogleProfile,
} from './auth-policy.js';
import { env } from './env.js';
import { sendPasswordResetEmail } from './services/auth-email.js';

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
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const [credential] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(
          eq(accounts.userId, user.id),
          eq(accounts.providerId, CREDENTIAL_PROVIDER_ID),
        ))
        .limit(1);
      if (!credential) return;

      await sendPasswordResetEmail({
        recipientEmail: user.email,
        resetUrl: url,
      });
    },
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
    // The API is a long-running Node service. Better Auth attaches sanitized
    // error logging before handing background work here, so password-reset
    // requests do not reveal account existence through email-provider timing.
    backgroundTasks: {
      handler: (promise) => { void promise; },
    },
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.betterAuthUrl.startsWith('https://'),
      path: '/',
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
