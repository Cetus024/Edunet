import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { db } from '../../../database/index.js';
import { accounts, sessions, users, verifications } from '../../../database/schema/auth.js';
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
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: false,
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
