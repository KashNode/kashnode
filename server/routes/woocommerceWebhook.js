import crypto from 'node:crypto';

const MAX_ORDER_ID_LENGTH = 100;
const MAX_LINE_ITEMS = 250;

function normalizeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 99999999
    ? amount.toFixed(2)
    : null;
}

function normalizeItemAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 99999999
    ? amount.toFixed(2)
    : null;
}

function normalizeCurrency(value) {
  if (typeof value !== 'string') return null;
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function normalizePaymentStatus(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === 'paid'
    ? 'paid'
    : 'unpaid';
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
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getCustomerName(body) {
  const supplied = body.customer_name;
  if (typeof supplied === 'string' && supplied.trim()) return supplied.trim().slice(0, 255);
  const first = typeof body.billing?.first_name === 'string' ? body.billing.first_name.trim() : '';
  const last = typeof body.billing?.last_name === 'string' ? body.billing.last_name.trim() : '';
  const combined = [first, last].filter(Boolean).join(' ');
  return combined ? combined.slice(0, 255) : null;
}

function cleanLineItems(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_LINE_ITEMS) return null;

  return value.map(item => ({
    id: item?.id == null ? null : String(item.id).slice(0, 100),
    product_id: item?.product_id == null ? null : String(item.product_id).slice(0, 100),
    variation_id: item?.variation_id == null ? null : String(item.variation_id).slice(0, 100),
    name: typeof item?.name === 'string' ? item.name.trim().slice(0, 255) : null,
    sku: typeof item?.sku === 'string' ? item.sku.trim().slice(0, 100) : null,
    quantity: Number.isInteger(Number(item?.quantity)) && Number(item.quantity) >= 0
      ? Number(item.quantity)
      : 0,
    subtotal: normalizeItemAmount(item?.subtotal ?? item?.total),
    total: normalizeItemAmount(item?.total ?? item?.subtotal),
  }));
}

function getStoredPaymentMethod(body) {
  const method = String(body.payment_method || '').trim().slice(0, 80);
  const title = String(body.payment_method_title || '').trim().slice(0, 80);
  const isCod = /^(cod|cash[\s_-]*on[\s_-]*delivery)$/i.test(method)
    || /cash\s*on\s*delivery/i.test(title);
  return isCod ? 'cod' : method || title || null;
}

const INSERT_ORDER_SQL = `
  INSERT INTO public.orders
    (merchant_id, platform_order_id, customer_phone, customer_name, total_amount,
     payment_status, delivery_status, payment_method, customer_trx_id, line_items,
     is_phone_verified, ai_call_status, currency)
  VALUES ($1, $2, $3, $4, $5::numeric, $6, 'pending', $7, $8, $9::jsonb, FALSE, 'pending', $10)
  RETURNING id, payment_status, delivery_status
`;

const UPDATE_ORDER_SQL = `
  UPDATE public.orders
  SET customer_phone = $2,
      customer_name = $3,
      total_amount = $4::numeric,
      payment_method = $5,
      customer_trx_id = $6,
      line_items = $7::jsonb,
      payment_status = CASE
        WHEN payment_status IN ('paid', 'manual_review') THEN payment_status
        ELSE $8
      END,
      currency = COALESCE($9, currency)
  WHERE id = $1
  RETURNING id, payment_status, delivery_status
`;

/**
 * New endpoint authentication:
 *   X-KashNode-Webhook-Secret: the merchant's stored webhook_secret
 *   X-WC-Webhook-Signature: base64(HMAC-SHA256(raw JSON bytes, webhook_secret))
 *
 * The legacy /api/v1/webhooks/woocommerce/:merchantId endpoint remains
 * compatible with WooCommerce's normal HMAC-only webhook delivery.
 */
export function createWooCommerceWebhookHandler({ pool, onOrderPersist = async () => {} }) {
  return async function ingestWooCommerceOrder(req, res) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });

    const body = req.body || {};
    const rawBody = req.rawBody;
    const signature = req.get('x-wc-webhook-signature');
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || !signature) {
      return res.status(401).json({ status: 'error', message: 'Invalid webhook credentials.' });
    }

    let merchant;
    const pathMerchantId = String(req.params?.merchantId || '').trim();

    if (pathMerchantId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pathMerchantId)) {
        return res.status(400).json({ status: 'error', message: 'A valid merchant ID is required in the webhook URL.' });
      }

      const result = await pool.query(
        'SELECT id, webhook_secret FROM public.merchants WHERE id = $1 LIMIT 1',
        [pathMerchantId],
      );
      merchant = result.rows[0];
    } else {
      const suppliedSecret = req.get('x-kashnode-webhook-secret') || req.get('x-merchant-secret') || '';
      if (typeof suppliedSecret !== 'string' || suppliedSecret.length < 32 || suppliedSecret.length > 255) {
        return res.status(401).json({ status: 'error', message: 'Invalid webhook credentials.' });
      }

      const result = await pool.query(
        'SELECT id, webhook_secret FROM public.merchants WHERE webhook_secret = $1 LIMIT 1',
        [suppliedSecret],
      );
      merchant = result.rows[0];
      if (!merchant?.id || !merchant.webhook_secret || !safeEqual(suppliedSecret, merchant.webhook_secret)) {
        return res.status(401).json({ status: 'error', message: 'Invalid webhook credentials.' });
      }
    }

    const secret = merchant?.webhook_secret;
    if (!merchant?.id || !secret) {
      return res.status(401).json({ status: 'error', message: 'Invalid webhook credentials.' });
    }

    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    if (!safeEqual(signature, expectedSignature)) {
      return res.status(401).json({ status: 'error', message: 'Invalid webhook signature.' });
    }

    const platformOrderId = String(body.platform_order_id ?? body.id ?? '').trim();
    const customerPhone = normalizeBdPhone(body.customer_phone ?? body.billing?.phone);
    const customerName = getCustomerName(body);
    const totalAmount = normalizeAmount(body.total_amount ?? body.total);
    const paymentMethod = getStoredPaymentMethod(body);
    const paymentStatus = normalizePaymentStatus(body.payment_status);
    const currency = normalizeCurrency(body.currency);
    const lineItems = cleanLineItems(body.line_items);
    const customerTrxId = typeof body.customer_trx_id === 'string'
      ? (body.customer_trx_id.trim().slice(0, 100) || null)
      : null;

    if (!platformOrderId || platformOrderId.length > MAX_ORDER_ID_LENGTH
      || !customerPhone || !totalAmount || lineItems === null) {
      return res.status(400).json({
        status: 'error',
        message: 'A valid order ID, Bangladesh customer phone, positive total and up to 250 line items are required.',
      });
    }

    const merchantId = String(merchant.id);
    const client = await pool.connect();
    let transactionOpen = false;
    let order;
    let quotaConsumed = false;

    try {
      await client.query('BEGIN');
      transactionOpen = true;

      // Serialize per-merchant deliveries so retries cannot double-spend quota.
      const merchantLock = await client.query(
        'SELECT id FROM public.merchants WHERE id = $1 FOR UPDATE',
        [merchantId],
      );
      if (!merchantLock.rows[0]) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });
      }

      const existingOrder = await client.query(
        `SELECT id, payment_status, delivery_status
         FROM public.orders
         WHERE merchant_id = $1 AND platform_order_id = $2
         LIMIT 1
         FOR UPDATE`,
        [merchantId, platformOrderId],
      );

      if (existingOrder.rows[0]) {
        const updated = await client.query(UPDATE_ORDER_SQL, [
          existingOrder.rows[0].id,
          customerPhone,
          customerName,
          totalAmount,
          paymentMethod,
          customerTrxId,
          JSON.stringify(lineItems),
          paymentStatus,
          currency,
        ]);
        order = updated.rows[0];
        if (!order) throw new Error('Order update did not return the updated order.');
      } else {
        const decrement = await client.query(
          `UPDATE public.merchants
           SET available_orders = available_orders - 1
           WHERE id = $1 AND available_orders > 0
           RETURNING available_orders`,
          [merchantId],
        );

        if (!decrement.rows[0]) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return res.status(403).json({
            status: 'error',
            code: 'LIMIT_EXCEEDED',
            message: 'Limit Exceeded',
            limit: 'available_orders',
          });
        }

        const inserted = await client.query(INSERT_ORDER_SQL, [
          merchantId,
          platformOrderId,
          customerPhone,
          customerName,
          totalAmount,
          paymentStatus,
          paymentMethod,
          customerTrxId,
          JSON.stringify(lineItems),
          currency,
        ]);
        order = inserted.rows[0];
        if (!order) throw new Error('Order insert did not return the created order.');
        quotaConsumed = true;
      }

      await client.query('COMMIT');
      transactionOpen = false;
    } catch (error) {
      if (transactionOpen) {
        await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
      }
      throw error;
    } finally {
      client.release();
    }

    try {
      await onOrderPersist(merchantId);
    } catch (error) {
      // Order data is durable; pending SMS can be retried on the next webhook.
      console.error('[KashNode] Pending SMS reconciliation deferred:', error);
    }

    return res.status(202).json({
      status: 'success',
      order_id: order.id,
      payment_status: order.payment_status,
      delivery_status: order.delivery_status,
      idempotent_upsert: true,
      quota_consumed: quotaConsumed,
    });
  };
}
