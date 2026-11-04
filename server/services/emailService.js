function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

export async function sendSignupOtpEmail({ to, name, otp, apiKey = process.env.RESEND_API_KEY, from = process.env.AUTH_EMAIL_FROM, fetchImpl = globalThis.fetch }) {
  if (!apiKey || !from) throw new Error('Email delivery is not configured.')
  const safeName = escapeHtml(name || 'there')
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Your KashNode verification code',
      text: `Hi ${name || 'there'}, your KashNode verification code is ${otp}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#14243a"><h2>Verify your KashNode account</h2><p>Hi ${safeName},</p><p>Use this one-time verification code to finish creating your KashNode account:</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;padding:18px 22px;background:#eef6ff;border-radius:12px;display:inline-block">${otp}</p><p>This code expires in <strong>10 minutes</strong> and can only be used once.</p><p>If you did not request this code, you can safely ignore this email.</p></div>`,
    }),
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Email delivery failed (${response.status}): ${detail.slice(0, 300)}`)
  }
}
