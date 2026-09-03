import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildSquadInvitationEmail,
  buildSquadInvitationUrl,
  sendSquadInvitationEmail,
} from '../src/services/squad-email.js';

const ORIGINAL_ENVIRONMENT = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  SQUAD_INVITE_FROM_EMAIL: process.env.SQUAD_INVITE_FROM_EMAIL,
  WEB_APP_URL: process.env.WEB_APP_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENVIRONMENT)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('study squad invitation email', () => {
  it('builds an acceptance URL without exposing the token anywhere else', () => {
    const token = 'a'.repeat(43);
    const url = buildSquadInvitationUrl('https://edunets.example/path', token);
    expect(url).toBe(`https://edunets.example/squad-invite?token=${token}`);
  });

  it('escapes names in HTML while keeping a useful plain-text fallback', () => {
    const content = buildSquadInvitationEmail({
      inviterName: '<script>Alex</script>',
      squadName: 'A & B',
      token: 'a'.repeat(43),
      acceptUrl: 'https://edunets.example/squad-invite?token=abc&source=email',
    });
    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&lt;script&gt;Alex&lt;/script&gt;');
    expect(content.html).toContain('A &amp; B');
    expect(content.text).toContain('https://edunets.example/squad-invite?token=abc&source=email');
  });

  it('sends through Resend with a stable idempotency key', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.SQUAD_INVITE_FROM_EMAIL = 'EduNets <squad@edunets.example>';
    process.env.WEB_APP_URL = 'https://edunets.example';
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ id: 'email-message-1' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));

    await expect(sendSquadInvitationEmail({
      invitationId: 'invitation-1',
      recipientEmail: 'friend@example.com',
      inviterName: 'Alex',
      squadName: 'Memory Makers',
      token: 'a'.repeat(43),
    }, fetchImplementation)).resolves.toEqual({ messageId: 'email-message-1' });

    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [, request] = fetchImplementation.mock.calls[0] ?? [];
    expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer re_test_key');
    expect(new Headers(request?.headers).get('Idempotency-Key'))
      .toBe('study-squad-invitation/invitation-1');
    expect(String(request?.body)).toContain('friend@example.com');
    expect(String(request?.body)).toContain('squad-invite');
  });

  it('fails clearly before any network call when email is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SQUAD_INVITE_FROM_EMAIL;
    delete process.env.WEB_APP_URL;
    const fetchImplementation = vi.fn<typeof fetch>();

    await expect(sendSquadInvitationEmail({
      invitationId: 'invitation-1',
      recipientEmail: 'friend@example.com',
      inviterName: 'Alex',
      squadName: 'Memory Makers',
      token: 'a'.repeat(43),
    }, fetchImplementation)).rejects.toMatchObject({ reason: 'configuration' });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
