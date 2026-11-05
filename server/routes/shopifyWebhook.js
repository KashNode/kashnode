import crypto from 'node:crypto';

const MAX_ORDER_ID_LENGTH = 100;
const MAX_LINE_ITEMS = 250;
const SHOP_DOMAIN_PATTERN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

function safeEqualBase64(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;
  const actualBytes = Buffer.from(actual, 'base64');
  const expectedBytes = Buffer.from(expected, 'base64');
  return actualBytes.length === expectedBytes.length
    && actualBytes.length > 0
    && crypto.timingSafeEqual(actualBytes, expectedBytes)
    && actualBytes.toString('base64') === actual
    && expectedBytes.toString('base64') === expected;
}

function normalizeShopDomain(value) {
  if (typeof value !== 'string') return null;
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  return SHOP_DOMAIN_PATTERN.test(domain) ? domain : null;
}

function normalizePhone(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const digits = String(value).replace(/\D/g, '');
  const last11 = digits.slice(-11);
  return /^01[3-9]\d{8}$/.test(last11) ? last11 : null;
}

function normalizeAmount(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 99999999
    ? amount.toFixed(2)
    : null;
}

function cleanText(value, maxLength = 255) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function getCustomerName(order) {
  const customer = order.customer || {};
  const address = order.shipping_address || order.billing_address || {};
  const first = cleanText(customer.first_name, 120) || cleanText(address.first_name, 120);
  const last = cleanText(customer.last_name, 120) || cleanText(address.last_name, 120);
  return cleanText([first, last].filter(Boolean).join(' '), 255)
    || cleanText(address.name, 255)
    || cleanText(order.name, 255);
}

function getLineItems(value) {
  if (!Array.isArray(value) || value.length > MAX_LINE_ITEMS) return null;
  return value.map(item => ({
    id: item?.id == null ? null : String(item.id).slice(0, 100),
    product_id: item?.product_id == null ? null : String(item.product_id).slice(0, 100),
    variant_id: item?.variant_id == null ? null : String(item.variant_id).slice(0, 100),
    title: cleanText(item?.title || item?.name, 255),
    sku: cleanText(item?.sku, 100),
    quantity: Number.isInteger(Number(item?.quantity)) && Number(item.quantity) >= 0
      ? Number(item.quantity)
      : 0,
    price: normalizeAmount(item?.price),
    vendor: cleanText(item?.vendor, 255),
  }));
}

function mapFinancialStatus(value) {
  const status = cleanText(value, 50)?.toLowerCase() || 'pending';
  if (status === 'paid') return 'paid';
  if (status === 'refunded' || status === 'voided' || status === 'partially_refunded') return 'manual_review';
  return 'unpaid';
}

function mapPaymentMethod(order) {
  const gateways = Array.isArray(order.payment_gateway_names) ? order.payment_gateway_names : [];
  return cleanText(gateways.find(value => typeof value === 'string' && value.trim()) || order.gateway, 80);
}

const INSERT_ORDER_SQL = `
  INSERT INTO public.orders
    (merchant_id, platform_order_id, customer_phone, customer_name, total_amount,
     payment_status, delivery_status, payment_method, line_items, financial_status, currency)
  VALUES ($1, $2, $3, $4, $5::numeric, $6, 'pending', $7, $8::jsonb, $9, $10)
  RETURNING id, payment_status, delivery_status
`;

const UPDATE_ORDER_SQL = `
  UPDATE public.orders
  SET customer_phone = $2,
      customer_name = $3,
      total_amount = $4::numeric,
      payment_method = $5,
      line_items = $6::jsonb,
      financial_status = $7,
      currency = $8,
      payment_status = CASE
        WHEN payment_status = 'paid' AND $9 = 'unpaid' THEN 'paid'
        ELSE $9
      END
  WHERE id = $1
  RETURNING id, payment_status, delivery_status
`;

/**
 * Shopify sends HMAC-SHA256(raw request bytes, app client secret) as base64.
 * Merchant lookup is scoped by Shopify's signed shop-domain header; the
 * merchant-specific secret is loaded from the database before verification.
 */
export function createShopifyWebhookHandler({ pool, onOrderPersist = async () => {} }) {
  return async function ingestShopifyOrder(req, res) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });

    const rawBody = req.body;
    const signature = req.get('x-shopify-hmac-sha256');
    const shopDomain = normalizeShopDomain(req.get('x-shopify-shop-domain'));

    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || !signature || !shopDomain) {
      return res.status(401).json({ status: 'error', message: 'Invalid webhook credentials.' });
    }

    const merchantResult = await pool.query(
      `SELECT id, shopify_webhook_secret
       FROM public.merchants
       WHERE lower(shopify_domain) = $1
       LIMIT 1`,
      [shopDomain],
    );
    const merchant = merchantResult.rows[0];
    if (!merchant?.id || !merchant.shopify_webhook_secret) {
      return res.status(401).json({ status: 'error', message: 'Invalid webhook credentials.' });
    }

    const expected = crypto.createHmac('sha256', merchant.shopify_webhook_secret)
      .update(rawBody)
      .digest('base64');
    if (!safeEqualBase64(signature, expected)) {
      return res.status(401).json({ status: 'error', message: 'Invalid webhook signature.' });
    }

    const topic = cleanText(req.get('x-shopify-topic'), 100)?.toLowerCase();
    if (topic && topic !== 'orders/create') {
      return res.status(200).json({ status: 'ignored', reason: 'unsupported_topic' });
    }

    let orderPayload;
    try {
      orderPayload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ status: 'error', message: 'Webhook payload must be valid JSON.' });
    }

    const platformOrderId = String(orderPayload?.id ?? '').trim();
    const customerPhone = normalizePhone(
      orderPayload?.customer?.phone
      || orderPayload?.shipping_address?.phone
      || orderPayload?.billing_address?.phone
      || orderPayload?.phone,
    );
    const customerName = getCustomerName(orderPayload || {});
    const totalAmount = normalizeAmount(orderPayload?.total_price);
    const lineItems = getLineItems(orderPayload?.line_items);
    const financialStatus = cleanText(orderPayload?.financial_status, 50)?.toLowerCase() || 'pending';
    const paymentStatus = mapFinancialStatus(financialStatus);
    const paymentMethod = mapPaymentMethod(orderPayload || {});
    const currency = cleanText(orderPayload?.currency, 3)?.toUpperCase() || null;

    if (!platformOrderId || platformOrderId.length > MAX_ORDER_ID_LENGTH
      || !customerPhone || totalAmount === null || lineItems === null) {
      return res.status(400).json({
        status: 'error',
        message: 'Shopify order must include a valid ID, Bangladesh customer phone, total_price and up to 250 line items.',
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
          JSON.stringify(lineItems),
          financialStatus,
          currency,
          paymentStatus,
        ]);
        order = updated.rows[0];
        if (!order) throw new Error('Shopify order update did not return the updated order.');
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
          JSON.stringify(lineItems),
          financialStatus,
          currency,
        ]);
        order = inserted.rows[0];
        if (!order) throw new Error('Shopify order insert did not return the created order.');
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
      console.error('[KashNode] Pending SMS reconciliation deferred after Shopify order:', error);
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
