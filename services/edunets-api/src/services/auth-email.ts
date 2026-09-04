const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_TIMEOUT_MS = 12_000;

export type PasswordResetEmailInput = {
  recipientEmail: string;
  resetUrl: string;
};

type AuthEmailConfig = {
  apiKey: string;
  fromEmail: string;
};

export class AuthEmailError extends Error {
  constructor(readonly reason: 'configuration' | 'delivery') {
    super(reason === 'configuration'
      ? 'Authentication email is not configured.'
      : 'Authentication email could not be delivered.');
    this.name = 'AuthEmailError';
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

function readConfig(): AuthEmailConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.AUTH_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) throw new AuthEmailError('configuration');
  return { apiKey, fromEmail };
}

export function buildPasswordResetEmail(resetUrl: string) {
  const safeUrl = escapeHtml(resetUrl);
  return {
    subject: 'Reset your EduNets password',
    text: `Reset your EduNets password: ${resetUrl}\n\nThis link expires in 1 hour and can only be used once. If you did not request this, you can ignore this email.`,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#1d3a62">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f4f7fb">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-radius:24px;background:#ffffff;padding:32px;box-shadow:0 16px 50px rgba(29,58,98,.12)">
          <tr><td>
            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#6684a7">EDUNETS ACCOUNT SECURITY</p>
            <h1 style="margin:0;font-size:30px;line-height:1.2">Reset your password</h1>
            <p style="margin:18px 0 26px;font-size:17px;line-height:1.6;color:#405a78">Use the button below to choose a new password for your EduNets account.</p>
            <a href="${safeUrl}" style="display:inline-block;border-radius:999px;background:#1d3a62;padding:14px 24px;color:#ffffff;text-decoration:none;font-weight:700">Reset password</a>
            <p style="margin:26px 0 0;font-size:13px;line-height:1.5;color:#71849a">This link expires in 1 hour and can only be used once. If you did not request it, you can safely ignore this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}

export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<{ messageId: string }> {
  const config = readConfig();
  const content = buildPasswordResetEmail(input.resetUrl);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), EMAIL_TIMEOUT_MS);

  try {
    const response = await fetchImplementation(RESEND_EMAIL_ENDPOINT, {
      method: 'POST',
      signal: abort.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [input.recipientEmail],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
    });

    if (!response.ok) throw new AuthEmailError('delivery');
    const payload = await response.json() as { id?: unknown };
    if (typeof payload.id !== 'string' || !payload.id) throw new AuthEmailError('delivery');
    return { messageId: payload.id };
  } catch (error) {
    if (error instanceof AuthEmailError) throw error;
    throw new AuthEmailError('delivery');
  } finally {
    clearTimeout(timer);
  }
}
