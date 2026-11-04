import crypto from 'node:crypto';

const MAX_ORDER_ID_LENGTH = 100;

function normalizeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 99999999
    ? amount.toFixed(2)
    : null;
}

function normalizeBdPhone(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const digits = String(value).replace(/\D/g, '');
  const last11 = digits.slice(-11);
  return /^01[3-9]\d{8}$/.test(last11) ? last11 : null;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getCustomerName(body) {
  const supplied = body.customer_name;
  if (typeof supplied === 'string' && supplied.trim()) return supplied.trim().slice(0, 255);
  const first = typeof body.billing?.first_name === 'string' ? body.billing.first_name.trim() : '';
  const last = typeof body.billing?.last_name === 'string' ? body.billing.last_name.trim() : '';
  const combined = [first, last].filter(Boolean).join(' ');
  return combined ? combined.slice(0, 255) : null;
}

export function createWooCommerceWebhookHandler({ pool, onOrderPersist = async () => {} }) {
  return async function ingestWooCommerceOrder(req, res) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });

    const body = req.body || {};
    // Prefer the merchant ID in the configured endpoint URL. The body fallback
    // supports custom integrations but is not required by standard Woo payloads.
    const merchantId = String(req.params?.merchantId || body.merchant_id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(merchantId)) {
      return res.status(400).json({ status: 'error', message: 'A valid merchant ID is required in the webhook URL.' });
    }

    const signature = req.get('x-wc-webhook-signature');
    if (typeof req.rawBody !== 'object' || !Buffer.isBuffer(req.rawBody) || !signature) {
      return res.status(401).json({ status: 'error', message: 'Invalid webhook credentials.' });
    }

    const merchantResult = await pool.query(
      'SELECT webhook_secret FROM merchants WHERE id = $1 LIMIT 1',
      [merchantId],
    );
    const secret = merchantResult.rows[0]?.webhook_secret;
    if (!secret) return res.status(401).json({ status: 'error', message: 'Invalid webhook credentials.' });

    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('base64');
    if (!safeEqual(signature, expected)) {
      return res.status(401).json({ status: 'error', message: 'Invalid webhook signature.' });
    }

    const platformOrderId = String(body.platform_order_id ?? body.id ?? '').trim();
    const customerPhone = normalizeBdPhone(body.customer_phone ?? body.billing?.phone);
    const customerName = getCustomerName(body);
    // WooCommerce total already includes the dynamically calculated delivery charge.
    const totalAmount = normalizeAmount(body.total_amount ?? body.total);
    const paymentMethod = String(body.payment_method ?? body.payment_method_title ?? '').trim().slice(0, 80);
    const customerTrxId = typeof body.customer_trx_id === 'string'
      ? (body.customer_trx_id.trim().slice(0, 100) || null)
      : null;

    if (!platformOrderId || platformOrderId.length > MAX_ORDER_ID_LENGTH || !customerPhone || !totalAmount) {
      return res.status(400).json({
        status: 'error',
        message: 'A valid WooCommerce order ID, Bangladesh customer phone and positive total are required.',
      });
    }

    const isCod = /^(cod|cash[\s_-]*on[\s_-]*delivery)$/i.test(paymentMethod)
      || /cash\s*on\s*delivery/i.test(String(body.payment_method_title || ''));
    const storedPaymentMethod = isCod ? 'cod' : paymentMethod || null;

    const upsertSql = [
      'INSERT INTO orders',
      '(merchant_id, platform_order_id, customer_phone, customer_name, total_amount, payment_status, delivery_status, payment_method, customer_trx_id)',
      "VALUES ($1, $2, $3, $4, $5::numeric, 'unpaid', 'pending', $6, $7)",
      'ON CONFLICT (merchant_id, platform_order_id) DO UPDATE SET',
      'customer_phone = EXCLUDED.customer_phone,',
      'customer_name = EXCLUDED.customer_name,',
      'total_amount = EXCLUDED.total_amount,',
      'payment_method = EXCLUDED.payment_method,',
      'customer_trx_id = EXCLUDED.customer_trx_id',
      'RETURNING id, payment_status, delivery_status',
    ].join('\n');

    const result = await pool.query(upsertSql, [
      merchantId,
      platformOrderId,
      customerPhone,
      customerName,
      totalAmount,
      storedPaymentMethod,
      customerTrxId,
    ]);

    try {
      await onOrderPersist(merchantId);
    } catch (error) {
      // Order ingestion is durable; pending SMS can be retried on the next event.
      console.error('[KashNode] Pending SMS reconciliation deferred:', error);
    }

    return res.status(202).json({
      status: 'success',
      order_id: result.rows[0].id,
      payment_status: result.rows[0].payment_status,
      delivery_status: result.rows[0].delivery_status,
      idempotent_upsert: true,
    });
  };
}
