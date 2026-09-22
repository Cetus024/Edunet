import type { AuthSession } from './auth.js';
import type { RequestVariables } from './errors.js';

export interface AppVariables extends RequestVariables {
  user: AuthSession['user'] | null;
  session: AuthSession['session'] | null;
}

export type AppEnv = {
  Variables: AppVariables;
};
