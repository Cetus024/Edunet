import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { db } from '../../../database/index.js';
import { accounts, sessions, users, verifications } from '../../../database/schema/auth.js';
import { env } from './env.js';

// HUAWEI CLOUD INTEGRATION POINT — IAM.
// better-auth owns end-user login (email/password sessions) below; it does
// not gate *service-to-service* access to RDS/OBS/ModelArts/CCE. In a
// Huawei Cloud deployment, IAM is the layer above all of that: a project-
// scoped IAM agency/role grants this API service (running on CCE or ECS)
// least-privilege credentials to reach RDS for PostgreSQL and OBS, and a
// separate scoped credential/role for whatever calls ModelArts - so a
// compromised app process can't reach more than it needs. IAM does not
// replace better-auth; it protects the infrastructure better-auth's own
// backend runs on.

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
