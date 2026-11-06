import crypto from 'node:crypto';
import { decryptIntegrationCredentials } from '../services/integrationCrypto.js';

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
    || cleanText(address.name, 255) || 'Shopify customer';
}

function skipWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function readJsonStringEnd(source, start) {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
    } else if (source[index] === '"') {
      return index + 1;
    }
  }
  throw new SyntaxError('Unterminated JSON string.');
}

function skipJsonValue(source, start) {
  const first = source[start];
  if (first === '"') return readJsonStringEnd(source, start);

  if (first === '{' || first === '[') {
    const stack = [first === '{' ? '}' : ']'];
    for (let index = start + 1; index < source.length; index += 1) {
      const character = source[index];
      if (character === '"') {
        index = readJsonStringEnd(source, index) - 1;
      } else if (character === '{') {
        stack.push('}');
      } else if (character === '[') {
        stack.push(']');
      } else if (character === '}' || character === ']') {
        if (stack.at(-1) !== character) throw new SyntaxError('Invalid JSON structure.');
        stack.pop();
        if (stack.length === 0) return index + 1;
      }
    }
    throw new SyntaxError('Unterminated JSON value.');
  }

  let index = start;
  while (index < source.length && !/[,}\]\s]/.test(source[index])) index += 1;
  return index;
}

// Shopify order IDs are 64-bit integers. JSON.parse can round values beyond
// Number.MAX_SAFE_INTEGER, so preserve the root-level ID token from raw JSON.
function extractTopLevelOrderId(source, parsedId) {
  let index = skipWhitespace(source, 0);
  if (source[index] !== '{') return parsedId == null ? null : String(parsedId);
  index += 1;

  while (index < source.length) {
    index = skipWhitespace(source, index);
    if (source[index] === '}') break;
    if (source[index] !== '"') break;

    const keyEnd = readJsonStringEnd(source, index);
    const key = JSON.parse(source.slice(index, keyEnd));
    index = skipWhitespace(source, keyEnd);
    if (source[index] !== ':') break;
    const valueStart = skipWhitespace(source, index + 1);
    const valueEnd = skipJsonValue(source, valueStart);
    const token = source.slice(valueStart, valueEnd).trim();

    if (key === 'id') {
      if (token.startsWith('"')) return String(JSON.parse(token));
      if (/^\d+$/.test(token)) return token;
      return parsedId == null ? null : String(parsedId);
    }

    index = skipWhitespace(source, valueEnd);
    if (source[index] !== ',') break;
    index += 1;
  }

  return parsedId == null ? null : String(parsedId);
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
  if (['partially_paid', 'refunded', 'voided', 'partially_refunded'].includes(status)) return 'manual_review';
  return 'unpaid';
}

function mapPaymentMethod(order) {
  const gateways = Array.isArray(order.payment_gateway_names) ? order.payment_gateway_names : [];
  return cleanText(gateways.find(value => typeof value === 'string' && value.trim()) || order.gateway, 80);
}

const UPSERT_ORDER_SQL = `
  INSERT INTO public.orders
    (merchant_id, platform_order_id, order_number, customer_phone, customer_name, total_amount,
     payment_status, delivery_status, payment_method, line_items, financial_status, fulfillment_status,
     currency, store_provider, shipping_address, shipping_city, shipping_zone, shipping_area,
     shipping_postcode, alternative_phone)
  VALUES ($1, $2, $3, $4, $5, $6::numeric, $7, $8, $9, $10::jsonb, $11, $12, $13, 'shopify', $14, $15, $16, $17, $18, $19)
  ON CONFLICT (merchant_id, platform_order_id) DO UPDATE SET
    order_number = EXCLUDED.order_number,
    customer_phone = EXCLUDED.customer_phone,
    customer_name = EXCLUDED.customer_name,
    total_amount = EXCLUDED.total_amount,
    payment_status = CASE WHEN public.orders.payment_status = 'paid' AND EXCLUDED.payment_status = 'unpaid'
      THEN public.orders.payment_status ELSE EXCLUDED.payment_status END,
    delivery_status = EXCLUDED.delivery_status,
    payment_method = EXCLUDED.payment_method,
    line_items = EXCLUDED.line_items,
    financial_status = EXCLUDED.financial_status,
    fulfillment_status = EXCLUDED.fulfillment_status,
    currency = EXCLUDED.currency,
    store_provider = 'shopify',
    shipping_address = COALESCE(EXCLUDED.shipping_address, public.orders.shipping_address),
    shipping_city = COALESCE(EXCLUDED.shipping_city, public.orders.shipping_city),
    shipping_zone = COALESCE(EXCLUDED.shipping_zone, public.orders.shipping_zone),
    shipping_area = COALESCE(EXCLUDED.shipping_area, public.orders.shipping_area),
    shipping_postcode = COALESCE(EXCLUDED.shipping_postcode, public.orders.shipping_postcode),
    alternative_phone = COALESCE(EXCLUDED.alternative_phone, public.orders.alternative_phone)
  RETURNING id, payment_status, delivery_status
`;

/**
 * Shopify sends HMAC-SHA256(raw request bytes, webhook secret) as base64.
 * The shop-domain header selects the merchant; that merchant's saved secret
 * is then used to verify the untouched request bytes before parsing JSON.
 */
export function createShopifyWebhookHandler({ pool, onOrderPersist = async () => {} }) {
  return async function ingestShopifyOrder(req, res) {
    if (!pool) {
      console.error('[Shopify Webhook] Database unavailable.');
      return res.status(503).json({ status: 'error', message: 'Database unavailable.' });
    }

    const rawBody = req.body;
    const signature = req.get('x-shopify-hmac-sha256');
    const shopDomain = normalizeShopDomain(req.get('x-shopify-shop-domain'));
    const topic = cleanText(req.get('x-shopify-topic'), 100)?.toLowerCase();
    console.info(`[Shopify Webhook] Incoming event: ${topic || 'unknown'} for store: ${shopDomain || 'unknown'}`);

    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || !signature || !shopDomain) {
      console.error('[Shopify Webhook] Validation failed: missing raw body, HMAC header, or valid shop domain.');
      console.error(new Error('Invalid Shopify webhook request').stack);
      return res.status(401).json({ status: 'error', message: 'Invalid webhook credentials.' });
    }

    const integrationResult = await pool.query(
      `SELECT merchant_id, credentials_ciphertext, credentials_nonce, credentials_auth_tag,
              credentials_key_version
       FROM public.merchant_integrations
       WHERE provider = 'shopify' AND is_active = TRUE
         AND lower(config->>'shopDomain') = $1
       LIMIT 1`,
      [shopDomain],
    );
    let merchantId = integrationResult.rows[0]?.merchant_id;
    const webhookSecrets = [];
    if (integrationResult.rows[0]) {
      const credentials = decryptIntegrationCredentials(integrationResult.rows[0]);
      for (const secret of [credentials.admin_webhook_secret, credentials.webhookSecret, credentials.clientSecret]) {
        if (typeof secret === 'string' && secret.trim() && !webhookSecrets.includes(secret.trim())) webhookSecrets.push(secret.trim());
      }
    } else {
      const legacy = await pool.query(
        `SELECT id, shopify_webhook_secret FROM public.merchants
         WHERE lower(shopify_domain) = $1 LIMIT 1`,
        [shopDomain],
      );
      merchantId = legacy.rows[0]?.id;
      if (typeof legacy.rows[0]?.shopify_webhook_secret === 'string' && legacy.rows[0].shopify_webhook_secret.trim()) {
        webhookSecrets.push(legacy.rows[0].shopify_webhook_secret.trim());
      }
    }
    const isValid = Boolean(merchantId && webhookSecrets.some(secret => {
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
      return safeEqualBase64(signature, expected);
    }));
    console.log(`[Shopify Webhook] HMAC verification: ${isValid ? 'PASSED' : 'FAILED'}`);
    if (!isValid) {
      console.error(`[Shopify Webhook Error] Invalid HMAC signature or no configured secret for ${shopDomain}.`);
      return res.status(401).json({ status: 'error', message: 'Invalid webhook signature.' });
    }


    if (!topic) {
      return res.status(400).json({ status: 'error', message: 'Shopify webhook topic header is required.' });
    }
    if (!['orders/create', 'orders/updated'].includes(topic)) {
      console.info(`[Shopify Webhook] Ignored unsupported event: ${topic} for store: ${shopDomain}`);
      return res.status(200).json({ status: 'ignored', reason: 'unsupported_topic' });
    }

    let orderPayload;
    try {
      orderPayload = JSON.parse(rawBody.toString('utf8'));
    } catch (error) {
      console.error(`[Shopify Webhook] Invalid JSON payload for ${shopDomain}:`, error?.stack || error);
      return res.status(400).json({ status: 'error', message: 'Webhook payload must be valid JSON.' });
    }
    if (!orderPayload || typeof orderPayload !== 'object' || Array.isArray(orderPayload)) {
      return res.status(400).json({ status: 'error', message: 'Shopify webhook payload must be a JSON object.' });
    }

    const platformOrderId = String(extractTopLevelOrderId(rawBody.toString('utf8'), orderPayload?.id) ?? '').trim();
    const customerPhone = cleanText(
      orderPayload?.phone || orderPayload?.customer?.phone
      || orderPayload?.shipping_address?.phone || orderPayload?.billing_address?.phone,
      30,
    );
    const customerName = getCustomerName(orderPayload || {});
    const totalAmount = normalizeAmount(orderPayload?.total_price);
    const lineItems = getLineItems(orderPayload?.line_items);
    const financialStatus = cleanText(orderPayload?.financial_status, 50)?.toLowerCase() || 'pending';
    const paymentMethod = mapPaymentMethod(orderPayload || {});
    const isCod = /cash on delivery|\bcod\b/i.test(paymentMethod || '');
    const paymentStatus = isCod ? 'unpaid' : mapFinancialStatus(financialStatus);
    const fulfillmentStatus = cleanText(orderPayload?.fulfillment_status, 50)?.toLowerCase() || 'unfulfilled';
    const deliveryStatus = fulfillmentStatus === 'fulfilled' ? 'fulfilled'
      : fulfillmentStatus === 'partial' ? 'partially_fulfilled' : 'pending';
    const orderNumber = cleanText(orderPayload?.name || (orderPayload?.order_number == null ? null : String(orderPayload.order_number)), 100)
      || platformOrderId;
    const currency = cleanText(orderPayload?.currency, 3)?.toUpperCase() || null;
    const shipping = orderPayload?.shipping_address || orderPayload?.billing_address || {};
    const shippingAddress = [shipping.address1, shipping.address2, shipping.city, shipping.province, shipping.zip, shipping.country]
      .filter(value => typeof value === 'string' && value.trim()).join(', ').slice(0, 1000) || null;
    const noteAttributes = Array.isArray(orderPayload?.note_attributes) ? orderPayload.note_attributes : [];
    const noteValue = key => noteAttributes.find(item => String(item?.name || '').toLowerCase() === key)?.value;
    const shippingCity = cleanText(noteValue('pathao_city_id'), 20);
    const shippingZone = cleanText(noteValue('pathao_zone_id'), 20);
    const shippingArea = cleanText(noteValue('pathao_area_id'), 20);
    const shippingPostcode = cleanText(shipping.zip, 20);
    const alternativePhone = normalizePhone(shipping.phone);

    if (!platformOrderId || platformOrderId.length > MAX_ORDER_ID_LENGTH
      || totalAmount === null || lineItems === null) {
      console.error(`[Shopify Webhook] Order validation failed for ${shopDomain}: id=${Boolean(platformOrderId)}, phone=${Boolean(customerPhone)}, total=${totalAmount !== null}, line_items=${lineItems !== null}`);
      return res.status(400).json({
        status: 'error',
        message: 'Shopify order must include a valid ID, total_price and up to 250 line items.',
      });
    }

    const resolvedMerchantId = String(merchantId);
    let order;
    try {
      const result = await pool.query(UPSERT_ORDER_SQL, [
        resolvedMerchantId, platformOrderId, orderNumber, customerPhone, customerName,
        totalAmount, paymentStatus, deliveryStatus, isCod ? 'Cash on Delivery' : (paymentMethod || 'Unknown'),
        JSON.stringify(lineItems), financialStatus, fulfillmentStatus, currency,
        shippingAddress, shippingCity, shippingZone, shippingArea, shippingPostcode, alternativePhone,
      ]);
      order = result.rows[0];
      if (!order) throw new Error('Shopify order upsert did not return the persisted order.');
      console.log(`[Shopify Webhook] Order #${orderPayload.order_number || orderPayload.id} successfully upserted into DB.`);
    } catch (error) {
      console.error('[Shopify Webhook Error] Failed to process webhook:', error.message);
      console.error(error.stack);
      throw error;
    }

    try {
      await onOrderPersist(resolvedMerchantId);
    } catch (error) {
      console.error('[Shopify Webhook] Pending SMS reconciliation deferred:', error?.stack || error);
    }

    return res.status(200).json({
      status: 'success',
      order_id: order.id,
      payment_status: order.payment_status,
      delivery_status: order.delivery_status,
      idempotent_upsert: true,
    });
  };
}
