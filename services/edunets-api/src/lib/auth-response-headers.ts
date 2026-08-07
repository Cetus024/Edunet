type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
};

function splitCombinedSetCookieHeader(value: string): string[] {
  const cookies: string[] = [];
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ',') continue;

    // A comma separates cookies only when the immediately following token is
    // a cookie-name followed by "=". This leaves the comma inside Expires
    // attributes intact (for example "Wed, 21 Oct 2015 ...").
    const remainder = value.slice(index + 1);
    if (!/^\s*[^=;,\s]+\s*=/.test(remainder)) continue;

    const cookie = value.slice(start, index).trim();
    if (cookie) cookies.push(cookie);
    start = index + 1;
  }

  const finalCookie = value.slice(start).trim();
  if (finalCookie) cookies.push(finalCookie);
  return cookies;
}

export function getSetCookieHeaders(headers: Headers | undefined): string[] {
  if (!headers) return [];

  const getSetCookie = (headers as HeadersWithSetCookie).getSetCookie;
  if (typeof getSetCookie === 'function') {
    return getSetCookie.call(headers).flatMap(splitCombinedSetCookieHeader);
  }

  const combined = headers.get('set-cookie');
  return combined ? splitCombinedSetCookieHeader(combined) : [];
}

export function appendSetCookieHeaders(source: Headers | undefined, target: Headers): void {
  for (const cookie of getSetCookieHeaders(source)) {
    target.append('set-cookie', cookie);
  }
}

/**
 * Copy only response metadata needed by an auth client on failure. No other
 * Better Auth headers are reflected, which keeps the unified API envelope from
 * becoming an unrestricted header proxy.
 */
export function appendSafeAuthErrorHeaders(source: Headers, target: Headers): void {
  appendSetCookieHeaders(source, target);

  const retryAfter = source.get('retry-after');
  if (retryAfter) target.set('retry-after', retryAfter);
}
