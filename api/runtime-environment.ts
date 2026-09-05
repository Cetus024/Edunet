const CORE_VARIABLES = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'CORS_ORIGINS',
] as const;

type RuntimeEnvironment = Record<string, string | undefined>;

function isExactHttpOrigin(value: string, allowHttp: boolean): boolean {
  try {
    const url = new URL(value);
    const protocolAllowed = url.protocol === 'https:' || (allowHttp && url.protocol === 'http:');
    return protocolAllowed && url.origin === value;
  } catch {
    return false;
  }
}

export function findInvalidRuntimeVariables(environment: RuntimeEnvironment): string[] {
  const invalid = new Set<string>();
  const values = Object.fromEntries(CORE_VARIABLES.map((name) => {
    const value = environment[name]?.trim() ?? '';
    if (!value) invalid.add(name);
    return [name, value];
  })) as Record<(typeof CORE_VARIABLES)[number], string>;

  if (values.DATABASE_URL) {
    try {
      const url = new URL(values.DATABASE_URL);
      const role = decodeURIComponent(url.username).split('.')[0];
      if (!['postgres:', 'postgresql:'].includes(url.protocol)
        || !url.hostname.endsWith('.pooler.supabase.com')
        || url.port !== '6543'
        || role !== 'edunets_app') {
        invalid.add('DATABASE_URL');
      }
    } catch {
      invalid.add('DATABASE_URL');
    }
  }

  if (values.BETTER_AUTH_SECRET && values.BETTER_AUTH_SECRET.length < 32) {
    invalid.add('BETTER_AUTH_SECRET');
  }

  const production = environment.NODE_ENV === 'production';
  if (values.BETTER_AUTH_URL
    && !isExactHttpOrigin(values.BETTER_AUTH_URL, !production)) {
    invalid.add('BETTER_AUTH_URL');
  }

  if (values.CORS_ORIGINS) {
    const origins = values.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
    if (origins.length === 0
      || origins.some((origin) => origin === '*' || !isExactHttpOrigin(origin, true))) {
      invalid.add('CORS_ORIGINS');
    }
  }

  return [...invalid].sort();
}
