import { describe, expect, it } from 'vitest';
import {
  appendSafeAuthErrorHeaders,
  appendSetCookieHeaders,
  getSetCookieHeaders,
} from '../src/lib/auth-response-headers.js';

describe('Better Auth response header forwarding', () => {
  it('forwards every Set-Cookie value without exposing unrelated headers', () => {
    const source = new Headers();
    source.append('set-cookie', 'session=one; Path=/; HttpOnly; SameSite=Lax');
    source.append('set-cookie', 'cache=two; Path=/; HttpOnly; SameSite=Lax');
    source.set('x-internal-auth-header', 'must-not-leak');
    const target = new Headers();

    appendSetCookieHeaders(source, target);

    expect(getSetCookieHeaders(target)).toEqual([
      'session=one; Path=/; HttpOnly; SameSite=Lax',
      'cache=two; Path=/; HttpOnly; SameSite=Lax',
    ]);
    expect(target.has('x-internal-auth-header')).toBe(false);
  });

  it('preserves Set-Cookie and Retry-After on normalized auth errors only', () => {
    const source = new Headers();
    source.append('set-cookie', 'session=; Max-Age=0; Path=/; HttpOnly');
    source.set('retry-after', '10');
    source.set('location', 'https://untrusted.example/redirect');
    const target = new Headers({ 'content-type': 'application/json' });

    appendSafeAuthErrorHeaders(source, target);

    expect(getSetCookieHeaders(target)).toEqual([
      'session=; Max-Age=0; Path=/; HttpOnly',
    ]);
    expect(target.get('retry-after')).toBe('10');
    expect(target.has('location')).toBe(false);
  });

  it('splits combined cookies without splitting an Expires date', () => {
    const headers = new Headers({
      'set-cookie': 'old=; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/, next=value; Path=/',
    });

    expect(getSetCookieHeaders(headers)).toEqual([
      'old=; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/',
      'next=value; Path=/',
    ]);
  });
});
