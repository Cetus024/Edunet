/**
 * Credentials for the two real demo accounts seeded in the database
 * (student@edunets.demo / teacher@edunets.demo), shown as quick-fill
 * shortcuts on the login page. These sign in through the real API like any
 * other account - there is no separate client-side demo auth path.
 */
const DEMO_PASSWORD = 'EduNets2026!';

export const DEMO_LOGIN_OPTIONS = [
  { email: 'student@edunets.demo', label: 'Student Demo', password: DEMO_PASSWORD },
  { email: 'teacher@edunets.demo', label: 'Teacher Demo', password: DEMO_PASSWORD },
] as const;
