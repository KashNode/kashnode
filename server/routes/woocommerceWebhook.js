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

const INSERT_ORDER_SQL = `
  INSERT INTO public.orders
    (merchant_id, platform_order_id, customer_phone, customer_name, total_amount,
     payment_status, delivery_status, payment_method, customer_trx_id)
  VALUES ($1, $2, $3, $4, $5::numeric, 'unpaid', 'pending', $6, $7)
  RETURNING id, payment_status, delivery_status
`;

const UPDATE_ORDER_SQL = `
  UPDATE public.orders
  SET customer_phone = $2,
      customer_name = $3,
      total_amount = $4::numeric,
      payment_method = $5,
      customer_trx_id = $6
  WHERE id = $1
  RETURNING id, payment_status, delivery_status
`;

/**
 * Consume one order only for a new order ID. The merchant row lock serializes
 * webhook deliveries for that merchant; checking for an existing order while
 * holding the lock makes retries idempotent. The decrement and order insert
 * share one transaction, so either both commit or neither does.
 */
export function createWooCommerceWebhookHandler({ pool, onOrderPersist = async () => {} }) {
  return async function ingestWooCommerceOrder(req, res) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });

    const body = req.body || {};
    const merchantId = String(req.params?.merchantId || body.merchant_id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(merchantId)) {
      return res.status(400).json({ status: 'error', message: 'A valid merchant ID is required in the webhook URL.' });
    }

    const signature = req.get('x-wc-webhook-signature');
    if (typeof req.rawBody !== 'object' || !Buffer.isBuffer(req.rawBody) || !signature) {
      return res.status(401).json({ status: 'error', message: 'Invalid webhook credentials.' });
    }

    const merchantResult = await pool.query(
      'SELECT webhook_secret FROM public.merchants WHERE id = $1 LIMIT 1',
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

    const client = await pool.connect();
    let transactionOpen = false;
    let order;
    let quotaConsumed = false;

    try {
      await client.query('BEGIN');
      transactionOpen = true;

      // Serialize order ingestion per merchant. This prevents two distinct
      // webhooks from both spending the same final quota unit.
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
        // A retry or a WooCommerce update changes the existing record but never
        // consumes another order from the subscription allowance.
        const updated = await client.query(UPDATE_ORDER_SQL, [
          existingOrder.rows[0].id,
          customerPhone,
          customerName,
          totalAmount,
          storedPaymentMethod,
          customerTrxId,
        ]);
        order = updated.rows[0];
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
          storedPaymentMethod,
          customerTrxId,
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
      // Order ingestion is durable; pending SMS can be retried on the next event.
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
