import test from 'node:test';
import assert from 'node:assert/strict';
import { createMerchantIntegrationHandlers } from '../server/routes/merchantIntegrations.js';
import { decryptIntegrationCredentials } from '../server/services/integrationCrypto.js';
import {
  normalizeShopifyDomain,
  requestShopifyClientCredentialsToken,
  refreshShopifyAccessToken,
} from '../server/services/integrationProviderService.js';

const KEY = Buffer.alloc(32, 7).toString('base64');
const ENV = { INTEGRATION_ENCRYPTION_KEY: KEY };
const NOW = Date.parse('2026-11-07T12:00:00.000Z');

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function okToken(accessToken = 'shopify-access-token') {
  return {
    ok: true,
    json: async () => ({ access_token: accessToken, scope: 'read_orders,write_orders', expires_in: 86399 }),
  };
}

test('Shopify domain validation accepts only a myshopify.com hostname', () => {
  assert.equal(normalizeShopifyDomain('STORE.myshopify.com'), 'store.myshopify.com');
  assert.throws(() => normalizeShopifyDomain('https://store.myshopify.com/path'));
  assert.throws(() => normalizeShopifyDomain('attacker.example'));
});

test('client credentials grant sends JSON and records scope and expiry', async () => {
  let requestedUrl;
  let request;
  const credentials = await requestShopifyClientCredentialsToken({
    shopDomain: 'store.myshopify.com',
    clientId: 'merchant-client-id',
    clientSecret: 'merchant-client-secret',
  }, {
    now: NOW,
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      request = options;
      return okToken();
    },
  });

  assert.equal(requestedUrl, 'https://store.myshopify.com/admin/oauth/access_token');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.body), {
    client_id: 'merchant-client-id',
    client_secret: 'merchant-client-secret',
    grant_type: 'client_credentials',
  });
  assert.equal(credentials.accessToken, 'shopify-access-token');
  assert.equal(credentials.scope, 'read_orders,write_orders');
  assert.equal(credentials.accessTokenExpiresAt, new Date(NOW + 86399 * 1000).toISOString());
  assert.equal(credentials.clientSecret, 'merchant-client-secret');
});

test('Shopify shop_not_permitted error explains organization restriction', async () => {
  await assert.rejects(
    requestShopifyClientCredentialsToken({
      shopDomain: 'store.myshopify.com', clientId: 'id', clientSecret: 'secret',
    }, { fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ error: 'shop_not_permitted' }) }) }),
    /not permitted to access that store/i,
  );
});

test('invalid Shopify credentials produce a friendly message', async () => {
  await assert.rejects(
    requestShopifyClientCredentialsToken({
      shopDomain: 'store.myshopify.com', clientId: 'bad', clientSecret: 'bad',
    }, { fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: 'invalid_client' }) }) }),
    /did not accept these credentials/i,
  );
});

test('merchant Shopify connect encrypts credentials, token, scope and expiry before saving', async () => {
  let savedValues;
  const pool = {
    async query(sql, values) {
      if (sql.includes('SELECT id, subscription_plan FROM public.merchants')) {
        return { rows: [{ id: 'merchant-1', subscription_plan: 'standard' }] };
      }
      if (sql.includes('INSERT INTO public.merchant_integrations')) {
        savedValues = values;
        return { rows: [] };
      }
      throw new Error('Unexpected SQL: ' + sql);
    },
  };
  const savedAt = Date.now();
  const handlers = createMerchantIntegrationHandlers({
    pool,
    env: ENV,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://store.myshopify.com/admin/oauth/access_token');
      assert.equal(JSON.parse(options.body).grant_type, 'client_credentials');
      return okToken('encrypted-token');
    },
  });
  const res = response();
  await handlers.connectShopify({
    session: { user: { id: 'user-1', merchantId: 'merchant-1', role: 'merchant' } },
    body: { shopDomain: 'store.myshopify.com', clientId: 'client-id', clientSecret: 'client-secret' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.status, 'connected');
  assert.equal(savedValues[0], 'merchant-1');
  assert.deepEqual(JSON.parse(savedValues[5]), { shopDomain: 'store.myshopify.com' });
  const decrypted = decryptIntegrationCredentials({
    credentials_ciphertext: savedValues[1],
    credentials_nonce: savedValues[2],
    credentials_auth_tag: savedValues[3],
    credentials_key_version: savedValues[4],
  }, ENV);
  assert.equal(decrypted.clientId, 'client-id');
  assert.equal(decrypted.clientSecret, 'client-secret');
  assert.equal(decrypted.accessToken, 'encrypted-token');
  assert.equal(decrypted.scope, 'read_orders,write_orders');
  const expiry = Date.parse(decrypted.accessTokenExpiresAt);
  assert.ok(expiry >= savedAt + 86398 * 1000 && expiry <= Date.now() + 86400 * 1000);
});

test('test-only Shopify connection verifies without persisting credentials', async () => {
  let inserted = false;
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT id, subscription_plan FROM public.merchants')) return { rows: [{ id: 'merchant-1' }] };
      if (sql.includes('INSERT INTO public.merchant_integrations')) inserted = true;
      return { rows: [] };
    },
  };
  const handlers = createMerchantIntegrationHandlers({
    pool, env: ENV, fetchImpl: async () => okToken(),
  });
  const res = response();
  await handlers.connectShopify({
    session: { user: { id: 'user-1', merchantId: 'merchant-1', role: 'merchant' } },
    body: { shopDomain: 'store.myshopify.com', clientId: 'id', clientSecret: 'secret', testOnly: true },
  }, res);
  assert.equal(res.payload.status, 'verified');
  assert.equal(inserted, false);
});

test('Shopify client credentials are renewed shortly before expiry', async () => {
  const credentials = {
    shopDomain: 'store.myshopify.com',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    accessToken: 'old-token',
    accessTokenExpiresAt: new Date(NOW + 60_000).toISOString(),
    scope: 'read_orders',
  };
  let calls = 0;
  const refreshed = await refreshShopifyAccessToken(credentials, {
    now: NOW,
    fetchImpl: async () => { calls += 1; return okToken('new-token'); },
  });
  assert.equal(calls, 1);
  assert.equal(refreshed.accessToken, 'new-token');
  assert.equal(refreshed.scope, 'read_orders,write_orders');
  assert.equal(refreshed.clientSecret, 'client-secret');
});
