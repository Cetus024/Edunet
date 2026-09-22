import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildPasswordResetEmail,
  sendPasswordResetEmail,
} from '../src/services/auth-email.js';

const ORIGINAL_ENVIRONMENT = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  AUTH_FROM_EMAIL: process.env.AUTH_FROM_EMAIL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENVIRONMENT)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('authentication email', () => {
  it('builds HTML and text password-reset content with an escaped link', () => {
    const resetUrl = 'https://edunets.example/reset-password?token=abc&returnTo=%2Fdashboard';
    const content = buildPasswordResetEmail(resetUrl);
    expect(content.subject).toBe('Reset your EduNets password');
    expect(content.text).toContain(resetUrl);
    expect(content.html).toContain('token=abc&amp;returnTo=');
    expect(content.html).toContain('expires in 1 hour');
  });

  it('sends password-reset mail through Resend without placing the token in headers', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.AUTH_FROM_EMAIL = 'EduNets <account@edunets.example>';
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ id: 'email-message-1' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    const resetUrl = 'https://api.edunets.example/api/auth/reset-password/secret-token';

    await expect(sendPasswordResetEmail({
      recipientEmail: 'student@example.com',
      resetUrl,
    }, fetchImplementation)).resolves.toEqual({ messageId: 'email-message-1' });

    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [, request] = fetchImplementation.mock.calls[0] ?? [];
    const headers = new Headers(request?.headers);
    expect(headers.get('Authorization')).toBe('Bearer re_test_key');
    expect([...headers.values()].join(' ')).not.toContain('secret-token');
    expect(String(request?.body)).toContain('student@example.com');
    expect(String(request?.body)).toContain('secret-token');
  });

  it('fails before making a request when auth email is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_FROM_EMAIL;
    const fetchImplementation = vi.fn<typeof fetch>();

    await expect(sendPasswordResetEmail({
      recipientEmail: 'student@example.com',
      resetUrl: 'https://edunets.example/reset-password?token=abc',
    }, fetchImplementation)).rejects.toMatchObject({ reason: 'configuration' });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
