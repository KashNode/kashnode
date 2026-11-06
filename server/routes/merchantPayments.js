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
    const minutes = Number(req.body?.minutes);
    if (!GATEWAYS.has(gateway) || !/^[A-Z0-9-]{5,40}$/.test(trxId)
      || !Number.isSafeInteger(minutes) || minutes <= 0) {
      return res.status(400).json({ message: 'Provide a valid gateway, TrxID and whole number of minutes.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT m.billing_phone, m.is_billing_phone_verified, p.slug, p.price_per_minute,
                p.minimum_topup_minutes
           FROM public.merchants m
           JOIN public.subscription_plans p ON lower(p.slug)=lower(m.subscription_plan) AND p.is_active=TRUE
          WHERE m.id=$1 AND m.owner_user_id=$2
          FOR SHARE OF m, p`,
        [who.merchantId, who.userId],
      );
      const merchant = result.rows[0];
      if (!merchant) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Merchant plan is unavailable. Contact support.' }); }
      if (!merchant.is_billing_phone_verified || !merchant.billing_phone) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Verify your billing phone before submitting a top-up.' });
      }
      if (req.body?.sender_phone && normalizePhone(req.body.sender_phone) !== merchant.billing_phone) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Sender phone must match your verified billing number.' });
      }
      const minimum = Number(merchant.minimum_topup_minutes);
      const rate = Number(merchant.price_per_minute);
      if (!Number.isSafeInteger(minimum) || minutes < minimum || !Number.isFinite(rate) || rate < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Selected minutes do not meet the active plan minimum.' });
      }
      const amount = (minutes * rate).toFixed(2);
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > 1000000) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Calculated top-up amount is outside the allowed range.' });
      }
      const inserted = await client.query(
        `INSERT INTO public.merchant_topups
          (merchant_id,gateway,trx_id,amount,sender_phone,minutes_purchased,plan_slug)
         VALUES ($1,$2,$3,$4::numeric,$5,$6,$7)
         RETURNING id,gateway,trx_id,amount,status,minutes_purchased,plan_slug,created_at`,
        [who.merchantId, gateway, trxId, amount, merchant.billing_phone, minutes, merchant.slug],
      );
      await client.query('COMMIT');
      let match = { outcome: 'pending' };
      try { match = await processor.matchExistingTopup({ merchantId: who.merchantId, gateway, trxId }); }
      catch (error) { console.error('[KashNode] Deferred top-up SMS reconciliation:', error); }
      const topup = { ...inserted.rows[0], status: match.outcome === 'matched_and_credited' ? 'matched' : 'pending' };
      return res.status(201).json({ status: topup.status, topup, calculatedAmount: amount, verification: match.outcome });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') return res.status(409).json({ message: 'This TrxID has already been submitted.' });
      throw error;
    } finally { client.release(); }
  }

  async function createPlanUpgradeRequest(req, res) {
    const who = identity(req);
    if (!who) return res.status(401).json({ message: 'Merchant authentication required.' });
    const planSlug = typeof req.body?.plan_slug === 'string' ? req.body.plan_slug.trim().toLowerCase() : '';
    const senderPhone = normalizePhone(req.body?.sender_phone);
    const gateway = req.body?.gateway;
    const trxId = typeof req.body?.trx_id === 'string' ? req.body.trx_id.trim().toUpperCase() : '';
    if (!/^[a-z0-9_-]{1,64}$/.test(planSlug) || !senderPhone
      || !['bKash','Nagad','Rocket'].includes(gateway) || !/^[A-Z0-9-]{5,40}$/.test(trxId)) {
      return res.status(400).json({ message: 'Provide a valid plan, sender mobile, MFS gateway and TrxID.' });
    }
    const plan = await pool.query(
      'SELECT slug FROM public.subscription_plans WHERE lower(slug)=lower($1) AND is_active=TRUE',
      [planSlug],
    );
    if (!plan.rows[0]) return res.status(400).json({ message: 'Selected plan is no longer available.' });
    const destination = await pool.query('SELECT 1 FROM public.mfs_payment_destinations WHERE provider=$1 AND is_active=TRUE LIMIT 1', [gateway]);
    if (!destination.rows[0]) return res.status(409).json({ message: 'This payment gateway has no official KashNode destination configured. Contact support.' });
    try {
      const result = await pool.query(
        `INSERT INTO public.merchant_plan_upgrade_requests
          (merchant_id,requested_plan_slug,sender_phone,gateway,trx_id,status)
         VALUES ($1,$2,$3,$4,$5,'pending_review')
         RETURNING id,requested_plan_slug,status,created_at`,
        [who.merchantId, plan.rows[0].slug, senderPhone, gateway, trxId],
      );
      return res.status(201).json({ status: 'pending_review', request: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'This TrxID has already been submitted.' });
      throw error;
    }
  }

  async function getMerchantBillingConfig(req, res) {
    const who = identity(req);
    if (!who) return res.status(401).json({ message: 'Merchant authentication required.' });
    const [plans, destinations, merchant] = await Promise.all([
      pool.query(`SELECT slug,name,monthly_fee,included_minutes,price_per_minute,
        minimum_topup_minutes,currency FROM public.subscription_plans
        WHERE is_active=TRUE ORDER BY display_order, name`),
      pool.query(`SELECT provider,account_label,phone_number FROM public.mfs_payment_destinations
        WHERE is_active=TRUE ORDER BY display_order,provider`),
      pool.query(`SELECT p.slug,p.name,p.price_per_minute,p.minimum_topup_minutes
        FROM public.merchants m JOIN public.subscription_plans p
          ON lower(p.slug)=lower(m.subscription_plan) AND p.is_active=TRUE
        WHERE m.id=$1 AND m.owner_user_id=$2`, [who.merchantId,who.userId]),
    ]);
    return res.json({ source: 'database', plans: plans.rows, destinations: destinations.rows, activePlan: merchant.rows[0] || null });
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

  return { requestBillingPhoneOtp, verifyBillingPhoneOtp, createTopup, createPlanUpgradeRequest, getMerchantBillingConfig, ingestAdminPaymentSms };
}
