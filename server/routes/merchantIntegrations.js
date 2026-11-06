import { decryptIntegrationCredentials, encryptIntegrationCredentials } from '../services/integrationCrypto.js';
import { validateIntegrationCredentials, testProviderCredentials, requestShopifyClientCredentialsToken, normalizeShopifyDomain, refreshShopifyAccessToken } from '../services/integrationProviderService.js';

const COURIER_PROVIDERS = new Set(['steadfast', 'pathao']);
const ALL_PROVIDERS = new Set(['steadfast', 'pathao', 'woocommerce', 'shopify']);

function identity(req) {
  const user = req.session?.user;
  if (!user?.id || !user?.merchantId || user.role === 'admin') return null;
  return { userId: String(user.id), merchantId: String(user.merchantId) };
}

async function verifyMerchant(pool, id) {
  const result = await pool.query(
    'SELECT id, subscription_plan FROM public.merchants WHERE id = $1 AND owner_user_id = $2 LIMIT 1',
    [id.merchantId, id.userId],
  );
  return result.rows[0] || null;
}

function validateStoreWebhookUrl(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a valid HTTPS webhook URL.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a valid HTTPS webhook URL.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.port && url.port !== '443'
    || url.hostname === 'localhost' || url.hostname.endsWith('.local') || url.hostname.endsWith('.localhost')) {
    throw new Error('Webhook URL must use a public HTTPS address without embedded credentials.');
  }
  return url.toString();
}

function publicMessage(error) {
  if (/INTEGRATION_ENCRYPTION_KEY/.test(error?.message || '')) {
    return 'Integration encryption is not configured on the server.';
  }
  return 'The integration request could not be completed. Check the credentials and try again.';
}

export function createMerchantIntegrationHandlers({ pool, env = process.env, fetchImpl = fetch } = {}) {
  async function list(req, res) {
    const id = identity(req);
    if (!id) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'Integrations are unavailable.' });
    const merchant = await verifyMerchant(pool, id);
    if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });
    const result = await pool.query(
      `SELECT provider, config, is_active, last_tested_at, last_test_status, last_test_message, updated_at
       FROM public.merchant_integrations WHERE merchant_id = $1 ORDER BY provider`,
      [id.merchantId],
    );
    return res.json({
      package: merchant.subscription_plan,
      integrations: result.rows.map(row => ({
        provider: row.provider,
        config: row.config || {},
        isActive: row.is_active,
        lastTestedAt: row.last_tested_at,
        lastTestStatus: row.last_test_status,
        lastTestMessage: row.last_test_message,
        updatedAt: row.updated_at,
        configured: true,
      })),
    });
  }


  async function connectShopify(req, res) {
    const id = identity(req);
    if (!id) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'Integrations are unavailable.' });
    const merchant = await verifyMerchant(pool, id);
    if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });

    try {
      const shopDomain = normalizeShopifyDomain(req.body?.shopDomain);
      const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId.trim() : '';
      const clientSecret = typeof req.body?.clientSecret === 'string' ? req.body.clientSecret.trim() : '';
      if (!clientId || clientId.length > 255 || !clientSecret || clientSecret.length > 1000) {
        throw new Error('Enter a valid Shopify Client ID and Client Secret.');
      }

      const tokenCredentials = await requestShopifyClientCredentialsToken(
        { shopDomain, clientId, clientSecret },
        { fetchImpl },
      );
      const webhookSecret = typeof req.body?.webhookSecret === 'string' ? req.body.webhookSecret.trim() : '';
      if (webhookSecret.length > 1000) throw new Error('Shopify Webhook Secret is too long.');
      const credentials = { ...tokenCredentials, ...(webhookSecret ? { webhookSecret } : {}) };
      if (req.body?.testOnly === true) {
        return res.status(200).json({ status: 'verified', provider: 'shopify', verified: true, message: 'Shopify credentials verified. Save & Connect to finish.' });
      }

      const encrypted = encryptIntegrationCredentials(credentials, env);
      const config = { shopDomain: credentials.shopDomain };
      await pool.query(
        `INSERT INTO public.merchant_integrations
          (merchant_id, provider, credentials_ciphertext, credentials_nonce, credentials_auth_tag,
           credentials_key_version, config, is_active, last_tested_at, last_test_status, last_test_message, updated_at)
         VALUES ($1,'shopify',$2,$3,$4,$5,$6::jsonb,TRUE,NOW(),'connected',$7,NOW())
         ON CONFLICT (merchant_id, provider) DO UPDATE SET
           credentials_ciphertext = EXCLUDED.credentials_ciphertext,
           credentials_nonce = EXCLUDED.credentials_nonce,
           credentials_auth_tag = EXCLUDED.credentials_auth_tag,
           credentials_key_version = EXCLUDED.credentials_key_version,
           config = EXCLUDED.config,
           is_active = TRUE,
           last_tested_at = NOW(),
           last_test_status = 'connected',
           last_test_message = EXCLUDED.last_test_message,
           updated_at = NOW()`,
        [id.merchantId, encrypted.ciphertext, encrypted.nonce, encrypted.authTag, encrypted.keyVersion,
          JSON.stringify(config), 'Shopify Client Credentials connection established.'],
      );
      return res.status(200).json({ status: 'connected', provider: 'shopify', configured: true, shopDomain: credentials.shopDomain });
    } catch (error) {
      const message = /INTEGRATION_ENCRYPTION_KEY/.test(error?.message || '')
        ? 'Secure integration storage is not configured on the server. Please contact support.'
        : (error?.message || 'Could not connect Shopify. Please check your details and try again.');
      return res.status(422).json({ status: 'error', message });
    }
  }


  function normalizeShopifyOrder(order) {
    const shipping = order.shipping_address || order.billing_address || {};
    const customer = order.customer || {};
    const phone = String(order.phone || customer.phone || shipping.phone || order.billing_address?.phone || '').trim() || null;
    const name = [customer.first_name || shipping.first_name, customer.last_name || shipping.last_name]
      .filter(Boolean).join(' ').trim() || shipping.name || customer.name || 'Shopify customer';
    const gatewayNames = Array.isArray(order.payment_gateway_names) ? order.payment_gateway_names : [];
    const gateway = gatewayNames.find(Boolean) || order.gateway || 'Unknown';
    const isCod = /cash on delivery|cod|cash on delivery \(.*\)/i.test(String(gateway));
    const financialStatus = String(order.financial_status || 'pending').toLowerCase();
    const paymentStatus = financialStatus === 'paid' ? 'paid'
      : ['partially_paid', 'refunded', 'voided', 'partially_refunded'].includes(financialStatus) ? 'manual_review' : 'unpaid';
    const fulfillmentStatus = String(order.fulfillment_status || 'unfulfilled').toLowerCase();
    const deliveryStatus = fulfillmentStatus === 'fulfilled' ? 'fulfilled'
      : fulfillmentStatus === 'partial' ? 'partially_fulfilled' : 'pending';
    const lineItems = (Array.isArray(order.line_items) ? order.line_items : []).slice(0, 250).map(item => ({
      id: item.id == null ? null : String(item.id),
      product_id: item.product_id == null ? null : String(item.product_id),
      variant_id: item.variant_id == null ? null : String(item.variant_id),
      title: String(item.title || item.name || '').slice(0, 255),
      sku: item.sku ? String(item.sku).slice(0, 100) : null,
      quantity: Math.max(0, Number(item.quantity) || 0),
      price: Number(item.price || 0).toFixed(2),
      vendor: item.vendor ? String(item.vendor).slice(0, 255) : null,
    }));
    const address = [shipping.address1, shipping.address2, shipping.city, shipping.province, shipping.zip, shipping.country]
      .filter(Boolean).join(', ').slice(0, 1000) || null;
    const amount = Number(order.total_price);
    if (!order.id || !Number.isFinite(amount) || amount < 0) return null;
    return {
      platformOrderId: String(order.id),
      orderNumber: String(order.name || order.order_number || order.number || order.id).slice(0, 100),
      customerName: String(name).slice(0, 255),
      customerPhone: phone,
      totalAmount: amount.toFixed(2),
      paymentStatus: isCod ? 'unpaid' : paymentStatus,
      paymentMethod: isCod ? 'Cash on Delivery' : String(gateway).slice(0, 80),
      financialStatus,
      fulfillmentStatus,
      deliveryStatus,
      currency: String(order.currency || 'BDT').slice(0, 3).toUpperCase(),
      shippingAddress: address,
      shippingPostcode: shipping.zip ? String(shipping.zip).slice(0, 20) : null,
      alternativePhone: shipping.phone && String(shipping.phone) !== phone ? String(shipping.phone).slice(0, 20) : null,
      lineItems,
      createdAt: order.created_at || null,
    };
  }

  async function getShopifyCredentials(merchantId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT credentials_ciphertext, credentials_nonce, credentials_auth_tag, credentials_key_version
         FROM public.merchant_integrations
         WHERE merchant_id = $1 AND provider = 'shopify' AND is_active = TRUE
         LIMIT 1 FOR UPDATE`,
        [merchantId],
      );
      if (!result.rows[0]) throw new Error('Connect your Shopify store before syncing orders.');
      const credentials = decryptIntegrationCredentials(result.rows[0], env);
      if (!credentials.shopDomain || !credentials.accessToken) throw new Error('Shopify connection is missing its access token. Reconnect the store.');
      const refreshed = await refreshShopifyAccessToken(credentials, { env, fetchImpl });
      if (refreshed !== credentials) {
        const encrypted = encryptIntegrationCredentials(refreshed, env);
        await client.query(
          `UPDATE public.merchant_integrations
           SET credentials_ciphertext = $3, credentials_nonce = $4, credentials_auth_tag = $5,
               credentials_key_version = $6, updated_at = NOW()
           WHERE merchant_id = $1 AND provider = 'shopify'`,
          [merchantId, 'shopify', encrypted.ciphertext, encrypted.nonce, encrypted.authTag, encrypted.keyVersion],
        );
      }
      await client.query('COMMIT');
      return refreshed;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function getOrders(req, res) {
    const id = identity(req);
    if (!id) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'Orders are unavailable.' });
    const merchant = await verifyMerchant(pool, id);
    if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });
    const result = await pool.query(
      `SELECT id, platform_order_id, order_number, customer_name, customer_phone, total_amount,
              payment_status, delivery_status, payment_method, financial_status, fulfillment_status,
              currency, shipping_address, line_items, created_at
       FROM public.orders WHERE merchant_id = $1
       ORDER BY created_at DESC LIMIT 200`,
      [id.merchantId],
    );
    return res.json({ source: 'database', orders: result.rows });
  }

  async function syncShopifyOrders(req, res) {
    const id = identity(req);
    if (!id) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'Order sync is unavailable.' });
    const merchant = await verifyMerchant(pool, id);
    if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });

    try {
      const credentials = await getShopifyCredentials(id.merchantId);
      const shopDomain = normalizeShopifyDomain(credentials.shopDomain);
      const apiVersion = credentials.apiVersion || '2026-10';
      const response = await fetchImpl(`https://${shopDomain}/admin/api/${apiVersion}/orders.json?status=any&limit=50`, {
        method: 'GET',
        redirect: 'error',
        headers: { Accept: 'application/json', 'X-Shopify-Access-Token': credentials.accessToken },
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('Shopify rejected the saved access token. Reconnect your store and try again.');
        throw new Error('Shopify could not return orders right now. Please try again later.');
      }
      if (!Array.isArray(payload.orders)) throw new Error('Shopify returned an unexpected orders response.');

      let synced = 0;
      let updated = 0;
      for (const rawOrder of payload.orders) {
        const order = normalizeShopifyOrder(rawOrder);
        if (!order) continue;
        const result = await pool.query(
          `INSERT INTO public.orders
            (merchant_id, platform_order_id, order_number, customer_phone, customer_name, total_amount,
             payment_status, delivery_status, payment_method, line_items, financial_status,
             fulfillment_status, currency, store_provider, shipping_address, shipping_postcode,
             alternative_phone, created_at)
           VALUES ($1,$2,$3,$4,$5,$6::numeric,$7,$8,$9,$10::jsonb,$11,$12,$13,'shopify',$14,$15,$16,
                   COALESCE($17::timestamptz,NOW()))
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
             shipping_address = EXCLUDED.shipping_address,
             shipping_postcode = EXCLUDED.shipping_postcode,
             alternative_phone = EXCLUDED.alternative_phone
           RETURNING (xmax = 0) AS inserted`,
          [id.merchantId, order.platformOrderId, order.orderNumber, order.customerPhone, order.customerName,
            order.totalAmount, order.paymentStatus, order.deliveryStatus, order.paymentMethod,
            JSON.stringify(order.lineItems), order.financialStatus, order.fulfillmentStatus, order.currency,
            order.shippingAddress, order.shippingPostcode, order.alternativePhone, order.createdAt],
        );
        if (result.rows[0]?.inserted) synced += 1;
        else updated += 1;
      }

      const orders = await pool.query(
        `SELECT id, platform_order_id, order_number, customer_name, customer_phone, total_amount,
                payment_status, delivery_status, payment_method, financial_status, fulfillment_status,
                currency, shipping_address, line_items, created_at
         FROM public.orders WHERE merchant_id = $1
         ORDER BY created_at DESC LIMIT 200`,
        [id.merchantId],
      );
      return res.json({ status: 'success', synced, updated, fetched: payload.orders.length, orders: orders.rows });
    } catch (error) {
      return res.status(422).json({ status: 'error', message: error.message || 'Shopify order sync failed.' });
    }
  }

  async function test(req, res) {
    const id = identity(req);
    if (!id) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'Integrations are unavailable.' });
    const provider = String(req.params.provider || '').toLowerCase();
    if (!ALL_PROVIDERS.has(provider)) return res.status(400).json({ status: 'error', message: 'Unsupported integration provider.' });
    if (provider === 'shopify') return res.status(400).json({ status: 'error', message: 'Use the Shopify Save & Connect action for merchant-owned app credentials.' });
    const merchant = await verifyMerchant(pool, id);
    if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });
    try {
      const credentials = validateIntegrationCredentials(provider, req.body?.credentials);
      if (provider === 'woocommerce') validateStoreWebhookUrl(req.body?.config?.webhookUrl);
      const message = await testProviderCredentials(provider, credentials);
      return res.json({ status: 'success', provider, message, verified: true });
    } catch (error) {
      return res.status(422).json({ status: 'error', verified: false, message: publicMessage(error) });
    }
  }

  async function save(req, res) {
    const id = identity(req);
    if (!id) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'Integrations are unavailable.' });
    const provider = String(req.params.provider || '').toLowerCase();
    if (!ALL_PROVIDERS.has(provider)) return res.status(400).json({ status: 'error', message: 'Unsupported integration provider.' });
    if (provider === 'shopify') return res.status(400).json({ status: 'error', message: 'Use the Shopify Save & Connect action for merchant-owned app credentials.' });
    const merchant = await verifyMerchant(pool, id);
    if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });
    try {
      const credentials = validateIntegrationCredentials(provider, req.body?.credentials);
      // Re-test on the server at save time; the browser's earlier test result is not trusted.
      const testMessage = await testProviderCredentials(provider, credentials);
      const encrypted = encryptIntegrationCredentials(credentials, env);
      const webhookUrl = provider === 'woocommerce' ? validateStoreWebhookUrl(req.body?.config?.webhookUrl) : null;
      const allowedConfig = {
        autoBook: COURIER_PROVIDERS.has(provider) ? req.body?.config?.autoBook !== false : false,
        ...(provider === 'shopify' ? { shopDomain: credentials.shopDomain } : {}),
        ...(webhookUrl ? { webhookUrl } : {}),
      };
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (COURIER_PROVIDERS.has(provider) && allowedConfig.autoBook) {
          await client.query(
            `UPDATE public.merchant_integrations
             SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{autoBook}', 'false'::jsonb, TRUE),
                 updated_at = NOW()
             WHERE merchant_id = $1 AND provider <> $2 AND provider IN ('steadfast','pathao')`,
            [id.merchantId, provider],
          );
        }
        await client.query(
          `INSERT INTO public.merchant_integrations
            (merchant_id, provider, credentials_ciphertext, credentials_nonce, credentials_auth_tag,
             credentials_key_version, config, is_active, last_tested_at, last_test_status, last_test_message, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,TRUE,NOW(),'connected',$8,NOW())
           ON CONFLICT (merchant_id, provider) DO UPDATE SET
             credentials_ciphertext = EXCLUDED.credentials_ciphertext,
             credentials_nonce = EXCLUDED.credentials_nonce,
             credentials_auth_tag = EXCLUDED.credentials_auth_tag,
             credentials_key_version = EXCLUDED.credentials_key_version,
             config = EXCLUDED.config,
             is_active = TRUE,
             last_tested_at = NOW(),
             last_test_status = 'connected',
             last_test_message = EXCLUDED.last_test_message,
             updated_at = NOW()`,
          [id.merchantId, provider, encrypted.ciphertext, encrypted.nonce, encrypted.authTag, encrypted.keyVersion,
            JSON.stringify(allowedConfig), testMessage],
        );
        {
          await client.query(
            "UPDATE public.courier_fulfillment_outbox SET status = 'pending', attempts = 0, next_attempt_at = NOW(), last_error = NULL, updated_at = NOW() WHERE merchant_id = $1 AND status = 'blocked'",
            [id.merchantId],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
      return res.json({ status: 'success', provider, configured: true, message: 'Connection verified and saved.' });
    } catch (error) {
      return res.status(422).json({ status: 'error', message: publicMessage(error) });
    }
  }

  async function remove(req, res) {
    const id = identity(req);
    if (!id) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'Integrations are unavailable.' });
    const provider = String(req.params.provider || '').toLowerCase();
    if (!ALL_PROVIDERS.has(provider)) return res.status(400).json({ status: 'error', message: 'Unsupported integration provider.' });
    const merchant = await verifyMerchant(pool, id);
    if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });
    await pool.query('DELETE FROM public.merchant_integrations WHERE merchant_id = $1 AND provider = $2', [id.merchantId, provider]);
    return res.json({ status: 'success', provider, configured: false });
  }

  return { list, connectShopify, getOrders, syncShopifyOrders, test, save, remove };
}
