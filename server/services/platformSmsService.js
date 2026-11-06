export async function sendPlatformSms({ to, message, env = process.env, fetchImpl = fetch }) {
  const endpoint = env.KASHNODE_SMS_GATEWAY_URL;
  const apiKey = env.KASHNODE_SMS_GATEWAY_API_KEY;
  if (!endpoint || !apiKey) throw new Error('SMS gateway is not configured.');
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ to, message }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`SMS gateway returned HTTP ${response.status}.`);
  return true;
}
