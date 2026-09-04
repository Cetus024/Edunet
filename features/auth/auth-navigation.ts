const AUTH_NAVIGATION_ORIGIN = 'https://edunets.local';

export const DEFAULT_AUTH_DESTINATION = '/onboarding';

export function getSafeReturnPath(value: string | null | undefined, fallback = DEFAULT_AUTH_DESTINATION): string {
  if (!value?.startsWith('/')) return fallback;

  try {
    const url = new URL(value, AUTH_NAVIGATION_ORIGIN);
    if (url.origin !== AUTH_NAVIGATION_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buildAuthPath(pathname: '/login' | '/signup' | '/forgot-password', returnTo: string): string {
  const params = new URLSearchParams({ returnTo: getSafeReturnPath(returnTo) });
  return `${pathname}?${params.toString()}`;
}
