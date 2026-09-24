const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_TIMEOUT_MS = 12_000;

export type SquadInvitationEmailInput = {
  invitationId: string;
  recipientEmail: string;
  inviterName: string;
  squadName: string;
  token: string;
};

type SquadEmailConfig = {
  apiKey: string;
  fromEmail: string;
  webAppUrl: string;
};

export class SquadEmailError extends Error {
  constructor(readonly reason: 'configuration' | 'delivery') {
    super(reason === 'configuration'
      ? 'Squad invitation email is not configured.'
      : 'Squad invitation email could not be delivered.');
    this.name = 'SquadEmailError';
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function readConfig(): SquadEmailConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.SQUAD_INVITE_FROM_EMAIL?.trim();
  const webAppUrl = process.env.WEB_APP_URL?.trim();
  if (!apiKey || !fromEmail || !webAppUrl) throw new SquadEmailError('configuration');

  let origin: string;
  try {
    const parsed = new URL(webAppUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol.');
    origin = parsed.origin;
  } catch {
    throw new SquadEmailError('configuration');
  }

  return { apiKey, fromEmail, webAppUrl: origin };
}

export function buildSquadInvitationUrl(webAppUrl: string, token: string): string {
  const url = new URL('/squad-invite', webAppUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export function buildSquadInvitationEmail(input: Omit<SquadInvitationEmailInput, 'invitationId' | 'recipientEmail'> & {
  acceptUrl: string;
}) {
  const squadName = escapeHtml(input.squadName);
  const inviterName = escapeHtml(input.inviterName);
  const acceptUrl = escapeHtml(input.acceptUrl);
  const subject = `${input.inviterName} invited you to ${input.squadName} on EduNets`;

  return {
    subject,
    text: `${input.inviterName} invited you to join ${input.squadName} on EduNets. Accept the invitation: ${input.acceptUrl}\n\nThis invitation expires in 7 days. If you did not expect it, you can ignore this email.`,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#1d3a62">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f4f7fb">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-radius:24px;background:#ffffff;padding:32px;box-shadow:0 16px 50px rgba(29,58,98,.12)">
          <tr><td>
            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#6684a7">EDUNETS STUDY SQUAD</p>
            <h1 style="margin:0;font-size:30px;line-height:1.2">Join ${squadName}</h1>
            <p style="margin:18px 0 26px;font-size:17px;line-height:1.6;color:#405a78"><strong>${inviterName}</strong> invited you to learn together, compare progress, and help each other with quick rescue sessions.</p>
            <a href="${acceptUrl}" style="display:inline-block;border-radius:999px;background:#1d3a62;padding:14px 24px;color:#ffffff;text-decoration:none;font-weight:700">Accept squad invitation</a>
            <p style="margin:26px 0 0;font-size:13px;line-height:1.5;color:#71849a">This invitation expires in 7 days. Only the invited email address can accept it.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}

export async function sendSquadInvitationEmail(
  input: SquadInvitationEmailInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<{ messageId: string }> {
  const config = readConfig();
  const acceptUrl = buildSquadInvitationUrl(config.webAppUrl, input.token);
  const content = buildSquadInvitationEmail({
    inviterName: input.inviterName,
    squadName: input.squadName,
    token: input.token,
    acceptUrl,
  });
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), EMAIL_TIMEOUT_MS);

  try {
    const response = await fetchImplementation(RESEND_EMAIL_ENDPOINT, {
      method: 'POST',
      signal: abort.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `study-squad-invitation/${input.invitationId}`,
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [input.recipientEmail],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
    });

    if (!response.ok) throw new SquadEmailError('delivery');
    const payload = await response.json() as { id?: unknown };
    if (typeof payload.id !== 'string' || !payload.id) throw new SquadEmailError('delivery');
    return { messageId: payload.id };
  } catch (error) {
    if (error instanceof SquadEmailError) throw error;
    throw new SquadEmailError('delivery');
  } finally {
    clearTimeout(timer);
  }
}
