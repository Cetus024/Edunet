export type SupabaseConnectionIdentity = {
  url: URL;
  projectRef: string;
  databaseRole: string;
  connectionMode: 'direct' | 'session' | 'transaction';
};

export function parseSupabaseConnection(value: string, label: string): SupabaseConnectionIdentity {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL.`);
  }

  const hostname = url.hostname.toLowerCase();
  const isDirect = hostname.startsWith('db.') && hostname.endsWith('.supabase.co');
  const isPooler = hostname.endsWith('.pooler.supabase.com');
  if (!isDirect && !isPooler) {
    throw new Error(`${label} must point to a Supabase database host.`);
  }

  const username = decodeURIComponent(url.username);
  const projectRef = isDirect
    ? hostname.split('.')[1] ?? ''
    : username.includes('.') ? username.split('.').at(-1) ?? '' : '';
  const databaseRole = isPooler ? username.split('.')[0] ?? '' : username;
  if (!projectRef || !databaseRole) {
    throw new Error(`${label} does not contain a Supabase project reference and database role.`);
  }

  const connectionMode = isDirect
    ? 'direct'
    : url.port === '6543' ? 'transaction' : 'session';

  return { url, projectRef, databaseRole, connectionMode };
}

export function assertSupabaseRuntimeConnection(connection: SupabaseConnectionIdentity): void {
  if (connection.connectionMode !== 'transaction' || connection.url.port !== '6543') {
    throw new Error('DATABASE_URL must use the Supabase transaction-mode pooler on port 6543.');
  }
  if (connection.databaseRole !== 'edunets_app') {
    throw new Error('DATABASE_URL must use the dedicated edunets_app database role.');
  }
}

export function assertSupabaseAdminConnection(connection: SupabaseConnectionIdentity): void {
  if (connection.connectionMode === 'transaction' || connection.url.port !== '5432') {
    throw new Error('DATABASE_DIRECT_URL must use Supabase direct or session mode on port 5432.');
  }
  if (connection.databaseRole !== 'postgres') {
    throw new Error('DATABASE_DIRECT_URL must use the Supabase postgres administrator role.');
  }
}

export function assertSameSupabaseProject(
  runtime: SupabaseConnectionIdentity,
  admin: SupabaseConnectionIdentity,
): void {
  if (runtime.projectRef !== admin.projectRef) {
    throw new Error('DATABASE_URL and DATABASE_DIRECT_URL must target the same Supabase project.');
  }
}
