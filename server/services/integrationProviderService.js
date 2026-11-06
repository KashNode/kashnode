import dns from 'node:dns/promises';
import net from 'node:net';

const PROVIDERS = new Set(['steadfast', 'pathao', 'woocommerce', 'shopify']);
const REQUEST_TIMEOUT_MS = 12000;

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isPrivateIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const parts = address.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
  }
  return family === 6 && (
    address === '::1' || address.startsWith('fc') || address.startsWith('fd')
    || address.startsWith('fe80:') || address === '::'
  );
}

export async function normalizeStoreUrl(value) {
  const raw = clean(value, 2048);
  let url;
  try { url = new URL(raw); } catch { throw new Error('Enter a valid store URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443') {
    throw new Error('Store URL must use HTTPS without embedded credentials or a custom port.');
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || net.isIP(hostname)) {
    throw new Error('Private or local network store URLs are not allowed.');
  }
  const resolved = await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!resolved.length || resolved.some(entry => isPrivateIp(entry.address))) {
    throw new Error('Store hostname must resolve only to public IP addresses.');
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      redirect: 'error',
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
    });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { /* provider error bodies are not reflected to clients */ }
    if (!response.ok) {
      const error = new Error('Provider rejected the credentials or request.');
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Provider connection timed out.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function assertProvider(provider) {
  if (!PROVIDERS.has(provider)) throw new Error('Unsupported integration provider.');
}

export function validateIntegrationCredentials(provider, input) {
  assertProvider(provider);
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  if (provider === 'steadfast') {
    const apiKey = clean(value.apiKey, 500);
    const secretKey = clean(value.secretKey, 500);
    if (!apiKey || !secretKey) throw new Error('Steadfast API Key and Secret Key are required.');
    return { apiKey, secretKey };
  }
  if (provider === 'pathao') {
    const clientId = clean(value.clientId, 255);
    const clientSecret = clean(value.clientSecret, 500);
    const username = clean(value.username, 255);
    const password = clean(value.password, 500);
    const storeId = Number(value.storeId);
    const baseUrl = value.environment === 'sandbox' ? 'https://courier-api-sandbox.pathao.com' : 'https://api-hermes.pathao.com';
    if (!clientId || !clientSecret || !username || !password || !Number.isSafeInteger(storeId) || storeId < 1) {
      throw new Error('Pathao Client ID, Client Secret, merchant email, password and Store ID are required.');
    }
    return { clientId, clientSecret, username, password, storeId, baseUrl, environment: value.environment === 'sandbox' ? 'sandbox' : 'production' };
  }
  if (provider === 'woocommerce') {
    const storeUrl = clean(value.storeUrl, 2048);
    const consumerKey = clean(value.consumerKey, 500);
    const consumerSecret = clean(value.consumerSecret, 500);
    if (!storeUrl || !consumerKey || !consumerSecret) throw new Error('WooCommerce store URL, Consumer Key and Consumer Secret are required.');
    return { storeUrl, consumerKey, consumerSecret };
  }
  const shopDomain = clean(value.shopDomain, 255).toLowerCase();
  const accessToken = clean(value.accessToken, 1000);
  const apiVersion = '2026-10';
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain) || !accessToken) {
    throw new Error('Enter a valid Shopify myshopify.com domain and Admin API access token.');
  }
  return { shopDomain, accessToken, apiVersion };
}

async function testSteadfast(credentials) {
  const payload = await requestJson('https://portal.packzy.com/api/v1/get_balance', {
    headers: { 'Api-Key': credentials.apiKey, 'Secret-Key': credentials.secretKey },
  });
  if (payload.status === 0 || payload.status === false) throw new Error('Steadfast did not accept these credentials.');
  return 'Steadfast credentials verified.';
}

async function pathaoToken(credentials) {
  const payload = await requestJson(`${credentials.baseUrl}/aladdin/api/v1/issue-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      username: credentials.username,
      password: credentials.password,
      grant_type: 'password',
    }),
  });
  const token = payload.access_token || payload.data?.access_token;
  if (!token) throw new Error('Pathao did not return an access token.');
  return token;
}

async function testPathao(credentials) {
  const token = await pathaoToken(credentials);
  await requestJson(`${credentials.baseUrl}/aladdin/api/v1/stores`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return 'Pathao credentials verified and merchant stores are accessible.';
}

async function testWooCommerce(credentials) {
  const storeUrl = await normalizeStoreUrl(credentials.storeUrl);
  const auth = Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString('base64');
  await requestJson(`${storeUrl}/wp-json/wc/v3/system_status`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return 'WooCommerce REST API credentials verified.';
}

async function testShopify(credentials) {
  const payload = await requestJson(`https://${credentials.shopDomain}/admin/api/${credentials.apiVersion}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': credentials.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'query { shop { id name } }' }),
  });
  if (payload.errors?.length || !payload.data?.shop?.id) throw new Error('Shopify Admin API rejected the requested shop access.');
  return 'Shopify Admin GraphQL API credentials verified.';
}

export async function testProviderCredentials(provider, credentials) {
  assertProvider(provider);
  if (provider === 'steadfast') return testSteadfast(credentials);
  if (provider === 'pathao') return testPathao(credentials);
  if (provider === 'woocommerce') return testWooCommerce(credentials);
  return testShopify(credentials);
}

export async function createCourierOrder(provider, credentials, order) {
  if (provider === 'steadfast') {
    const payload = await requestJson('https://portal.packzy.com/api/v1/create_order', {
      method: 'POST',
      headers: {
        'Api-Key': credentials.apiKey,
        'Secret-Key': credentials.secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice: String(order.platform_order_id).slice(0, 50),
        recipient_name: order.customer_name || 'Customer',
        recipient_phone: order.customer_phone,
        alternative_phone: order.alternative_phone || undefined,
        recipient_address: order.shipping_address,
        cod_amount: Number(order.payment_status === 'paid' ? 0 : order.total_amount),
        note: `KashNode order ${order.platform_order_id}`,
        item_description: (order.line_items || []).map(item => item.name || item.title || '').filter(Boolean).join(', ').slice(0, 200),
      }),
    });
    const data = payload.data || payload;
    const consignmentId = data.consignment_id || data.consignmentId || data.id;
    if (!consignmentId) throw new Error('Steadfast response did not include a consignment ID.');
    return { consignmentId: String(consignmentId), trackingCode: String(data.tracking_code || data.trackingCode || consignmentId), raw: payload };
  }

  if (provider === 'pathao') {
    const token = await pathaoToken(credentials);
    const payload = await requestJson(`${credentials.baseUrl}/aladdin/api/v1/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: credentials.storeId,
        merchant_order_id: String(order.platform_order_id).slice(0, 100),
        recipient_name: order.customer_name || 'Customer',
        recipient_phone: order.customer_phone,
        recipient_address: order.shipping_address,
        delivery_type: 48,
        item_type: 2,
        item_quantity: Math.max(1, (order.line_items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)),
        item_weight: '0.5',
        item_description: (order.line_items || []).map(item => item.name || item.title || '').filter(Boolean).join(', ').slice(0, 200) || 'E-commerce order',
        amount_to_collect: Number(order.payment_status === 'paid' ? 0 : order.total_amount),
        recipient_city: Number(order.shipping_city),
        recipient_zone: Number(order.shipping_zone),
        recipient_area: order.shipping_area ? Number(order.shipping_area) : undefined,
      }),
    });
    const data = payload.data || payload;
    const consignmentId = data.consignment_id || data.consignmentId || data.id;
    if (!consignmentId) throw new Error('Pathao response did not include a consignment ID.');
    return { consignmentId: String(consignmentId), trackingCode: String(data.tracking_code || consignmentId), raw: payload };
  }
  throw new Error('Unsupported courier provider.');
}

export async function syncTrackingToStore(provider, credentials, order, tracking) {
  if (provider === 'woocommerce') {
    const storeUrl = await normalizeStoreUrl(credentials.storeUrl);
    const auth = Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString('base64');
    await requestJson(`${storeUrl}/wp-json/wc/v3/orders/${encodeURIComponent(order.platform_order_id)}`, {
      method: 'PUT',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_note: `Your parcel is booked. Courier: ${tracking.provider}. Tracking ID: ${tracking.trackingCode}`,
        meta_data: [{ key: '_kashnode_courier', value: tracking.provider }, { key: '_kashnode_tracking_id', value: tracking.trackingCode }],
      }),
    });
    return;
  }
  if (provider === 'shopify') {
    const mutation = 'mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { id } userErrors { field message } } }';
    const payload = await requestJson(`https://${credentials.shopDomain}/admin/api/${credentials.apiVersion}/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': credentials.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: mutation,
        variables: { metafields: [
          { ownerId: `gid://shopify/Order/${order.platform_order_id}`, namespace: 'kashnode', key: 'courier', type: 'single_line_text_field', value: tracking.provider },
          { ownerId: `gid://shopify/Order/${order.platform_order_id}`, namespace: 'kashnode', key: 'tracking_id', type: 'single_line_text_field', value: tracking.trackingCode },
        ] },
      }),
    });
    const errors = payload.data?.orderUpdate?.userErrors || [];
    if (errors.length) throw new Error('Shopify rejected the tracking update.');
  }
}
