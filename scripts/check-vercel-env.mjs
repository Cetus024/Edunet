const PRODUCTION_ORIGIN = 'https://edunet-two.vercel.app';

function isAbsoluteUrl(value, protocols) {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol);
  } catch {
    return false;
  }
}

function validateProductionEnvironment(environment) {
  const invalid = new Set();
  const requireValue = (name) => {
    const value = environment[name]?.trim() ?? '';
    if (!value) invalid.add(name);
    return value;
  };

  const databaseUrl = requireValue('DATABASE_URL');
  const authSecret = requireValue('BETTER_AUTH_SECRET');
  const authUrl = requireValue('BETTER_AUTH_URL');
  requireValue('GOOGLE_CLIENT_ID');
  requireValue('GOOGLE_CLIENT_SECRET');
  const corsOrigins = requireValue('CORS_ORIGINS');
  const publicApiUrl = requireValue('NEXT_PUBLIC_EDUNETS_API_URL');
  const webAppUrl = requireValue('WEB_APP_URL');

  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      if (!['postgres:', 'postgresql:'].includes(url.protocol)
        || !url.hostname.endsWith('.pooler.supabase.com')
        || url.port !== '6543'
        || decodeURIComponent(url.username).split('.')[0] !== 'edunets_app') {
        invalid.add('DATABASE_URL');
      }
    } catch {
      invalid.add('DATABASE_URL');
    }
  }

  if (authSecret && authSecret.length < 32) invalid.add('BETTER_AUTH_SECRET');
  if (authUrl && (!isAbsoluteUrl(authUrl, ['https:']) || new URL(authUrl).origin !== PRODUCTION_ORIGIN)) {
    invalid.add('BETTER_AUTH_URL');
  }
  if (publicApiUrl
    && (!isAbsoluteUrl(publicApiUrl, ['https:']) || new URL(publicApiUrl).origin !== PRODUCTION_ORIGIN)) {
    invalid.add('NEXT_PUBLIC_EDUNETS_API_URL');
  }
  if (webAppUrl
    && (!isAbsoluteUrl(webAppUrl, ['https:']) || new URL(webAppUrl).origin !== PRODUCTION_ORIGIN)) {
    invalid.add('WEB_APP_URL');
  }

  if (corsOrigins) {
    const origins = corsOrigins.split(',').map((value) => value.trim()).filter(Boolean);
    if (origins.length === 0 || !origins.includes(PRODUCTION_ORIGIN)) {
      invalid.add('CORS_ORIGINS');
    } else {
      for (const origin of origins) {
        if (!isAbsoluteUrl(origin, ['https:']) || new URL(origin).origin !== origin) {
          invalid.add('CORS_ORIGINS');
          break;
        }
      }
    }
  }

  return [...invalid].sort();
}

if (process.env.VERCEL_ENV === 'production') {
  const invalidVariables = validateProductionEnvironment(process.env);
  if (invalidVariables.length > 0) {
    console.error(`Production environment preflight failed: ${invalidVariables.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('Production environment preflight passed.');
  }
}

export { validateProductionEnvironment };
