import crypto from 'node:crypto';

const GATEWAYS = new Set(['bKash', 'Nagad', 'Rocket', 'Upay']);
function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00880')) digits = '0' + digits.slice(5);
  else if (digits.startsWith('880')) digits = '0' + digits.slice(3);
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}
function identity(req) {
  const u = req.session?.user;
  return u?.id && u?.merchantId && u.role !== 'admin'
    ? { userId: String(u.id), merchantId: String(u.merchantId) } : null;
}
function hashOtp(code, secret) {
  return crypto.createHmac('sha256', secret).update(code).digest('hex');
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function createMerchantPaymentHandlers({ pool, sendSms, otpSecret, processor }) {
  async function requestBillingPhoneOtp(req, res) {
    const who = identity(req);
    if (!who) return res.status(401).json({ message: 'Merchant authentication required.' });
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ message: 'Enter a valid Bangladesh MFS mobile number.' });
    if (!otpSecret || !sendSms) return res.status(503).json({ message: 'Billing phone SMS verification is not configured.' });

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE public.phone_verifications SET attempts=6
          WHERE merchant_id=$1 AND purpose='billing_phone' AND verified_at IS NULL AND expires_at>NOW()`,
        [who.merchantId],
      );
      await client.query(
        `INSERT INTO public.phone_verifications (merchant_id, phone, code_hash, expires_at)
         VALUES ($1,$2,$3,NOW()+INTERVAL '5 minutes')`,
        [who.merchantId, phone, hashOtp(code, otpSecret)],
      );
      await client.query(
        'UPDATE public.merchants SET billing_phone=$2, is_billing_phone_verified=FALSE WHERE id=$1 AND owner_user_id=$3',
        [who.merchantId, phone, who.userId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }

    try { await sendSms({ to: phone, message: `Your KashNode billing phone verification code is ${code}. It expires in 5 minutes.` }); }
    catch (error) {
      await pool.query('UPDATE public.merchants SET is_billing_phone_verified=FALSE WHERE id=$1', [who.merchantId]);
      return res.status(502).json({ message: 'Could not send verification SMS. Please try again.' });
    }
    return res.status(202).json({ status: 'otp_sent', expiresInSeconds: 300 });
  }

  async function verifyBillingPhoneOtp(req, res) {
    const who = identity(req);
    if (!who) return res.status(401).json({ message: 'Merchant authentication required.' });
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!/^\d{6}$/.test(code) || !otpSecret) return res.status(400).json({ message: 'Enter the 6-digit verification code.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT id, phone, code_hash, attempts FROM public.phone_verifications
          WHERE merchant_id=$1 AND purpose='billing_phone' AND verified_at IS NULL
            AND expires_at>NOW() AND attempts<6
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [who.merchantId],
      );
      const record = result.rows[0];
      if (!record || !safeEqual(record.code_hash, hashOtp(code, otpSecret))) {
        if (record) await client.query('UPDATE public.phone_verifications SET attempts=attempts+1 WHERE id=$1', [record.id]);
        await client.query('COMMIT');
        return res.status(400).json({ message: 'Invalid or expired verification code.' });
      }
      await client.query('UPDATE public.phone_verifications SET verified_at=NOW() WHERE id=$1', [record.id]);
      await client.query(
        'UPDATE public.merchants SET billing_phone=$2, is_billing_phone_verified=TRUE WHERE id=$1 AND owner_user_id=$3',
        [who.merchantId, record.phone, who.userId],
      );
      await client.query('COMMIT');
      return res.json({ status: 'verified', billingPhone: record.phone, isBillingPhoneVerified: true });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async function createTopup(req, res) {
    const who = identity(req);
    if (!who) return res.status(401).json({ message: 'Merchant authentication required.' });
    const gateway = req.body?.gateway;
    const trxId = typeof req.body?.trx_id === 'string' ? req.body.trx_id.trim().toUpperCase() : '';
    const amount = Number(req.body?.amount);
    if (!GATEWAYS.has(gateway) || !/^[A-Z0-9-]{5,40}$/.test(trxId) || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      return res.status(400).json({ message: 'Provide a valid gateway, TrxID and amount.' });
    }
    const merchant = await pool.query(
      'SELECT billing_phone, is_billing_phone_verified FROM public.merchants WHERE id=$1 AND owner_user_id=$2',
      [who.merchantId, who.userId],
    );
    if (!merchant.rows[0]?.is_billing_phone_verified || !merchant.rows[0]?.billing_phone) {
      return res.status(403).json({ message: 'Verify your billing phone before submitting a top-up.' });
    }
    if (req.body?.sender_phone && normalizePhone(req.body.sender_phone) !== merchant.rows[0].billing_phone) {
      return res.status(400).json({ message: 'Sender phone must match your verified billing number.' });
    }
    try {
      const inserted = await pool.query(
        `INSERT INTO public.merchant_topups (merchant_id,gateway,trx_id,amount,sender_phone)
         VALUES ($1,$2,$3,$4::numeric,$5) RETURNING id,gateway,trx_id,amount,status,created_at`,
        [who.merchantId, gateway, trxId, amount.toFixed(2), merchant.rows[0].billing_phone],
      );
      let match = { outcome: 'pending' };
      try { match = await processor.matchExistingTopup({ merchantId: who.merchantId, gateway, trxId }); }
      catch (error) { console.error('[KashNode] Deferred top-up SMS reconciliation:', error); }
      const topup = { ...inserted.rows[0], status: match.outcome === 'matched_and_credited' ? 'matched' : 'pending' };
      return res.status(201).json({ status: topup.status, topup, verification: match.outcome });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'This TrxID has already been submitted.' });
      throw error;
    }
  }

  async function ingestAdminPaymentSms(req, res) {
    const { gateway, trx_id: trxId, amount, sender_phone: senderPhone,
      receiver_phone: receiverPhone, received_at: receivedAt, message, device_id: deviceId } = req.body || {};
    const normalizedSender = normalizePhone(senderPhone);
    const normalizedReceiver = normalizePhone(receiverPhone);
    const parsedAmount = Number(amount);
    if (!GATEWAYS.has(gateway) || typeof trxId !== 'string' || !/^[A-Z0-9-]{5,40}$/i.test(trxId.trim())
      || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !normalizedSender || !normalizedReceiver
      || typeof message !== 'string' || !message.trim() || message.length > 8000
      || typeof deviceId !== 'string' || !deviceId.trim()
      || !receivedAt || !Number.isFinite(Date.parse(receivedAt))) {
      return res.status(400).json({ message: 'Invalid payment notification payload.' });
    }
    const outcome = await processor.ingest({
      gateway, trxId: trxId.trim().toUpperCase(), amount: parsedAmount.toFixed(2),
      senderPhone: normalizedSender, receiverPhone: normalizedReceiver,
      receivedAt: new Date(receivedAt).toISOString(), deviceId: deviceId.trim(),
      rawMessage: message.trim(),
    });
    return res.status(202).json({ status: 'accepted', ...outcome });
  }

  return { requestBillingPhoneOtp, verifyBillingPhoneOtp, createTopup, ingestAdminPaymentSms };
}
