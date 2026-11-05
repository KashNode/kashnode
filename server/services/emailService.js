const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PERSONAL_MAILBOX_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
]);

export class EmailDeliveryError extends Error {
  constructor(message, code, statusCode = 502) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function extractSenderAddress(from) {
  if (typeof from !== 'string' || !from.trim()) return null;
  const angleAddress = from.match(/<([^<>]+)>/);
  const address = (angleAddress?.[1] || from).trim();
  if (!EMAIL_PATTERN.test(address)) return null;
  return address.toLowerCase();
}

function validateEmailConfiguration(apiKey, from) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new EmailDeliveryError(
      'RESEND_API_KEY is missing. Configure a Resend sending API key on the backend.',
      'RESEND_API_KEY_MISSING',
      503,
    );
  }

  if (typeof from !== 'string' || !from.trim()) {
    throw new EmailDeliveryError(
      'AUTH_EMAIL_FROM is missing. Configure a sender address on a domain verified in Resend.',
      'AUTH_EMAIL_FROM_MISSING',
      503,
    );
  }

  const senderAddress = extractSenderAddress(from);
  if (!senderAddress) {
    throw new EmailDeliveryError(
      'AUTH_EMAIL_FROM must be formatted as "KashNode <no-reply@your-verified-domain.com>".',
      'AUTH_EMAIL_FROM_INVALID',
      503,
    );
  }

  const senderDomain = senderAddress.split('@')[1];
  if (PERSONAL_MAILBOX_DOMAINS.has(senderDomain)) {
    throw new EmailDeliveryError(
      `AUTH_EMAIL_FROM uses ${senderDomain}, a public mailbox domain that cannot be verified for Resend sending. Use an address on a domain you own and have verified in Resend.`,
      'EMAIL_SENDER_DOMAIN_UNVERIFIABLE',
      503,
    );
  }
}

export async function sendSignupOtpEmail({
  to,
  name,
  otp,
  apiKey = process.env.RESEND_API_KEY,
  from = process.env.AUTH_EMAIL_FROM,
  fetchImpl = globalThis.fetch,
}) {
  validateEmailConfiguration(apiKey, from);

  if (typeof to !== 'string' || !EMAIL_PATTERN.test(to.trim())) {
    throw new EmailDeliveryError('A valid recipient email address is required.', 'EMAIL_RECIPIENT_INVALID', 400);
  }
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    throw new EmailDeliveryError('A six-digit signup verification code is required.', 'OTP_INVALID', 400);
  }
  if (typeof fetchImpl !== 'function') {
    throw new EmailDeliveryError('The server does not provide an HTTP client for email delivery.', 'EMAIL_TRANSPORT_UNAVAILABLE', 503);
  }

  const safeName = escapeHtml(name || 'there');
  let response;
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from: from.trim(),
        to: [to.trim()],
        subject: 'Your KashNode verification code',
        text: `Hi ${name || 'there'}, your KashNode verification code is ${otp}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#14243a"><h2>Verify your KashNode account</h2><p>Hi ${safeName},</p><p>Use this one-time verification code to finish creating your KashNode account:</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;padding:18px 22px;background:#eef6ff;border-radius:12px;display:inline-block">${otp}</p><p>This code expires in <strong>10 minutes</strong> and can only be used once.</p><p>If you did not request this code, you can safely ignore this email.</p></div>`,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new EmailDeliveryError(
      `Resend API request failed: ${String(error?.message || 'network or timeout error').slice(0, 200)}`,
      'RESEND_NETWORK_ERROR',
      502,
    );
  }

  const responseText = await response.text().catch(() => '');
  let payload = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    // Keep the provider's non-JSON response as a bounded diagnostic below.
  }

  if (!response.ok) {
    const providerMessage = typeof payload?.message === 'string'
      ? payload.message
      : responseText.slice(0, 300) || 'No error detail returned.';
    const providerCode = typeof payload?.name === 'string' ? payload.name : 'RESEND_API_ERROR';
    throw new EmailDeliveryError(
      `Resend rejected the signup email (HTTP ${response.status}): ${providerMessage.slice(0, 300)}`,
      providerCode,
      502,
    );
  }

  if (typeof payload?.id !== 'string' || !payload.id) {
    throw new EmailDeliveryError(
      'Resend returned a successful HTTP response without an email ID. Check the Resend API logs before retrying.',
      'RESEND_INVALID_SUCCESS_RESPONSE',
      502,
    );
  }

  // This means Resend accepted the request, not that the recipient inbox has
  // accepted or displayed the message. Delivery status is visible in Resend.
  return { id: payload.id };
}
