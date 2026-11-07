import crypto from 'node:crypto';

function safeEqualHex(left, right) {
  if (typeof left !== 'string' || !/^[a-f0-9]{64}$/i.test(left)) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** HMAC over timestamp + nonce + exact raw HTTP body. */
export function createDeviceSignatureVerifier({ pool, secret, toleranceSeconds = 300, now = () => Date.now() }) {
  return async function verifyDeviceSignature(req, res, next) {
    if (!secret || Buffer.byteLength(secret) < 32) {
      return res.status(503).json({ message: 'Device request signing is not configured.' });
    }
    const timestamp = req.get('x-kashnode-timestamp') || '';
    const nonce = req.get('x-kashnode-nonce') || '';
    const signature = req.get('x-kashnode-signature') || '';
    const seconds = Number(timestamp);
    if (!/^\\d{10}$/.test(timestamp) || !Number.isSafeInteger(seconds)
      || Math.abs(Math.floor(now() / 1000) - seconds) > toleranceSeconds
      || !/^[A-Za-z0-9_-]{20,128}$/.test(nonce)
      || !Buffer.isBuffer(req.rawBody)) {
      return res.status(401).json({ message: 'Invalid or expired device signature.' });
    }
    const body = req.rawBody.toString('utf8');
    const expected = crypto.createHmac('sha256', secret)
      .update(`${timestamp}.${nonce}.${body}`)
      .digest('hex');
    if (!safeEqualHex(signature, expected)) {
      return res.status(401).json({ message: 'Invalid or expired device signature.' });
    }
    try {
      const inserted = await pool.query(
        `INSERT INTO public.mfs_device_nonces (nonce, device_id, expires_at)
         VALUES ($1,$2,NOW()+INTERVAL '10 minutes')
         ON CONFLICT (nonce) DO NOTHING RETURNING nonce`,
        [nonce, req.body?.device_id || 'unknown'],
      );
      if (!inserted.rowCount) return res.status(409).json({ message: 'Device request replay detected.' });
      return next();
    } catch (error) { return next(error); }
  };
}

export function signDevicePayload({ secret, timestamp, nonce, rawBody }) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${nonce}.${rawBody}`).digest('hex');
}
