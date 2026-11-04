import crypto from 'node:crypto';

const MAX_ORDER_ID = 100;
const normalizeAmount = value => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 99999999 ? n.toFixed(2) : null;
};
const normalizePhone = value => typeof value === 'string' ? value.trim().slice(0, 20) : '';
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export function createWooCommerceWebhookHandler({ pool }) {
  return async function ingestWooCommerceOrder(req, res) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });
    const body = req.body || {};
    const merchantId = typeof body.merchant_id === 'string' ? body.merchant_id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(merchantId)) {
      return res.status(400).json({ status: 'error', message: 'A valid merchant_id is required.' });
    }
    const secretResult = await pool.query('SELECT webhook_secret FROM merchants WHERE id = $1 LIMIT 1', [merchantId]);
    const secret = secretResult.rows[0]?.webhook_secret;
    const signature = req.get('x-wc-webhook-signature');
    const rawBody = req.rawBody;
    if (!secret || !signature || !rawBody) return res.status(401).json({ status: 'error', message: 'Invalid webhook credentials.' });
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    if (!safeEqual(signature, expected)) return res.status(401).json({ status: 'error', message: 'Invalid webhook signature.' });

    const platformOrderId = String(body.platform_order_id ?? body.id ?? '').trim();
    const phone = normalizePhone(body.customer_phone ?? body.billing?.phone);
    const name = typeof (body.customer_name ?? body.billing?.first_name) === 'string'
      ? String(body.customer_name ?? [body.billing?.first_name, body.billing?.last_name].filter(Boolean).join(' ')).trim().slice(0,255) : null;
    const totalAmount = normalizeAmount(body.total_amount ?? body.total);
    const paymentMethod = String(body.payment_method ?? '').trim().slice(0,80);
    const customerTrxId = typeof body.customer_trx_id === 'string' ? body.customer_trx_id.trim().slice(0,100) : null;
    if (!platformOrderId || platformOrderId.length > MAX_ORDER_ID || !phone || totalAmount === null) {
      return res.status(400).json({ status: 'error', message: 'platform_order_id, valid customer_phone and total_amount are required.' });
    }

    const isCod = /^(cod|cash_on_delivery)$/i.test(paymentMethod) || /cash on delivery/i.test(String(body.payment_method_title || ''));
    const result = await pool.query(
      `INSERT INTO orders
       (merchant_id, platform_order_id, customer_phone, customer_name, total_amount,
        payment_status, delivery_status, payment_method, customer_trx_id)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)
       ON CONFLICT (merchant_id, platform_order_id) DO UPDATE SET
         customer_phone=EXCLUDED.customer_phone,
         customer_name=EXCLUDED.customer_name,
         total_amount=EXCLUDED.total_amount,
         payment_method=EXCLUDED.payment_method,
         customer_trx_id=EXCLUDED.customer_trx_id
       RETURNING id, payment_status, delivery_status`,
      [merchantId, platformOrderId, phone, name, totalAmount, 'unpaid', isCod ? 'cod' : paymentMethod, customerTrxId]);
    return res.status(202).json({ status: 'success', order_id: result.rows[0].id, payment_status: result.rows[0].payment_status, idempotent: true });
  };
}
