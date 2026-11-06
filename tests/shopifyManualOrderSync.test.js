import test from 'node:test';
import assert from 'node:assert/strict';
import { createMerchantIntegrationHandlers } from '../server/routes/merchantIntegrations.js';
import { encryptIntegrationCredentials, decryptIntegrationCredentials } from '../server/services/integrationCrypto.js';

const KEY = Buffer.alloc(32, 11).toString('base64');
const ENV = { INTEGRATION_ENCRYPTION_KEY: KEY };

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function integrationRow(credentials) {
  const encrypted = encryptIntegrationCredentials(credentials, ENV);
  return {
    credentials_ciphertext: encrypted.ciphertext,
    credentials_nonce: encrypted.nonce,
    credentials_auth_tag: encrypted.authTag,
    credentials_key_version: encrypted.keyVersion,
  };
}

const session = { user: { id: 'user-1', merchantId: 'merchant-1', role: 'merchant' } };

test('manual Shopify sync refreshes a near-expiry token and upserts returned orders', async () => {
  const expiredSoon = {
    shopDomain: 'store.myshopify.com',
    clientId: 'merchant-client-id',
    clientSecret: 'merchant-client-secret',
    accessToken: 'old-token',
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    scope: 'read_orders',
    apiVersion: '2026-10',
  };
  const encryptedRow = integrationRow(expiredSoon);
  const storedCredentials = [];
  const upserts = [];
  const orders = [
    { id: 9001, name: '#1001', order_number: 1001, created_at: '2026-11-06T10:00:00Z',
      total_price: '1250.00', currency: 'BDT', financial_status: 'pending', fulfillment_status: null,
      payment_gateway_names: ['Cash on Delivery (COD)'], phone: '01712345678',
      customer: { first_name: 'Test', last_name: 'Buyer' },
      shipping_address: { address1: '12 Main Road', city: 'Dhaka', province: 'Dhaka', zip: '1207', phone: '01712345678' },
      line_items: [{ id: 1, title: 'Test item', sku: 'SKU-1', quantity: 2, price: '625.00' }] },
    { id: 9002, name: '#1002', created_at: '2026-11-06T11:00:00Z',
      total_price: '800.00', currency: 'BDT', financial_status: 'paid', fulfillment_status: 'fulfilled',
      payment_gateway_names: ['bKash'], customer: { first_name: 'Paid', last_name: 'Customer' },
      shipping_address: { address1: 'Road 2', city: 'Dhaka' }, line_items: [] },
  ];
  const pool = {
    async query(sql, values) {
      if (sql.includes('SELECT id, subscription_plan FROM public.merchants')) {
        return { rows: [{ id: 'merchant-1', subscription_plan: 'standard' }] };
      }
      if (sql.includes('INSERT INTO public.orders')) {
        upserts.push({ sql, values });
        return { rows: [{ inserted: upserts.length === 1 }] };
      }
      if (sql.includes('SELECT id, platform_order_id, order_number')) {
        return { rows: [{ id: 'order-1', platform_order_id: '9001', order_number: '#1001' }] };
      }
      throw new Error('Unexpected pool query: ' + sql);
    },
    async connect() {
      return {
        async query(sql, values) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
          if (sql.includes('SELECT credentials_ciphertext')) return { rows: [encryptedRow] };
          if (sql.includes('UPDATE public.merchant_integrations')) {
            storedCredentials.push(values);
            return { rows: [] };
          }
          throw new Error('Unexpected client query: ' + sql);
        },
        release() {},
      };
    },
  };
  let tokenRefreshCalls = 0;
  let orderFetchUrl = '';
  const handlers = createMerchantIntegrationHandlers({
    pool,
    env: ENV,
    fetchImpl: async (url, options) => {
      if (url.endsWith('/admin/oauth/access_token')) {
        tokenRefreshCalls += 1;
        assert.equal(JSON.parse(options.body).grant_type, 'client_credentials');
        return { ok: true, json: async () => ({ access_token: 'fresh-token', scope: 'read_orders,write_orders', expires_in: 86399 }) };
      }
      orderFetchUrl = url;
      assert.equal(options.headers['X-Shopify-Access-Token'], 'fresh-token');
      return { ok: true, json: async () => ({ orders }) };
    },
  });
  const res = response();
  await handlers.syncShopifyOrders({ session }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.status, 'success');
  assert.equal(res.payload.synced, 1);
  assert.equal(res.payload.updated, 1);
  assert.equal(res.payload.fetched, 2);
  assert.equal(tokenRefreshCalls, 1);
  assert.equal(orderFetchUrl, 'https://store.myshopify.com/admin/api/2026-10/orders.json?status=any&limit=50');
  assert.equal(upserts.length, 2);
  assert.equal(upserts[0].values[1], '9001');
  assert.equal(upserts[0].values[2], '#1001');
  assert.equal(upserts[0].values[3], '01712345678');
  assert.equal(upserts[0].values[6], 'unpaid');
  assert.equal(upserts[0].values[8], 'Cash on Delivery');
  assert.equal(JSON.parse(upserts[0].values[9])[0].title, 'Test item');
  assert.equal(upserts[1].values[6], 'paid');
  assert.equal(upserts[1].values[11], 'fulfilled');
  assert.equal(storedCredentials.length, 1);
  const saved = decryptIntegrationCredentials({
    credentials_ciphertext: storedCredentials[0][2],
    credentials_nonce: storedCredentials[0][3],
    credentials_auth_tag: storedCredentials[0][4],
    credentials_key_version: storedCredentials[0][5],
  }, ENV);
  assert.equal(saved.accessToken, 'fresh-token');
});

test('manual Shopify sync requires an active Shopify integration', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT id, subscription_plan FROM public.merchants')) return { rows: [{ id: 'merchant-1' }] };
      throw new Error('Unexpected query');
    },
    async connect() {
      return {
        async query(sql) {
          if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
          if (sql.includes('SELECT credentials_ciphertext')) return { rows: [] };
          throw new Error('Unexpected query');
        },
        release() {},
      };
    },
  };
  const handlers = createMerchantIntegrationHandlers({ pool, env: ENV });
  const res = response();
  await handlers.syncShopifyOrders({ session }, res);
  assert.equal(res.statusCode, 422);
  assert.match(res.payload.message, /connect your Shopify store/i);
});
