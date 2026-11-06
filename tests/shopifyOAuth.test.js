import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createShopifyOAuthHandlers } from '../server/routes/shopifyOAuth.js';
import { decryptIntegrationCredentials } from '../server/services/integrationCrypto.js';
import { refreshShopifyAccessToken } from '../server/services/integrationProviderService.js';

const SECRET = 'shopify-client-secret';
const KEY = Buffer.alloc(32, 9).toString('base64');
const ENV = {
  NODE_ENV: 'test',
  APP_URL: 'https://app.example.com',
  SHOPIFY_CLIENT_ID: 'shopify-client-id',
  SHOPIFY_CLIENT_SECRET: SECRET,
  SHOPIFY_SCOPES: 'read_orders,write_orders',
  INTEGRATION_ENCRYPTION_KEY: KEY,
};

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    send(payload) { this.payload = payload; return this; },
    cookie(name, value, options) { this.headers.cookie = { name, value, options }; return this; },
    clearCookie(name, options) { this.headers.clearedCookie = { name, options }; return this; },
    redirect(code, url) { this.statusCode = code; this.redirectUrl = url; return this; },
  };
}

test('Shopify auth validates shop and redirects with scoped CSRF state', () => {
  const handlers = createShopifyOAuthHandlers({ pool: { query: async () => ({ rows: [] }) }, env: ENV });
  const res = response();
  handlers.auth({ query: { shop: 'https://sample-store.myshopify.com/' }, session: { user: { id: 'user-1', merchantId: 'merchant-1' } } }, res);
  assert.equal(res.statusCode, 302);
  const url = new URL(res.redirectUrl);
  assert.equal(url.hostname, 'sample-store.myshopify.com');
  assert.equal(url.pathname, '/admin/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), ENV.SHOPIFY_CLIENT_ID);
  assert.equal(url.searchParams.get('scope'), ENV.SHOPIFY_SCOPES);
  assert.equal(url.searchParams.get('redirect_uri'), 'https://app.example.com/api/merchant/integrations/shopify/callback');
  assert.equal(url.searchParams.get('state'), res.headers.cookie.value);
  assert.equal(res.headers.cookie.options.httpOnly, true);
  assert.equal(res.headers.cookie.options.sameSite, 'lax');
});

test('Shopify auth rejects non-Shopify and unsafe shop domains', () => {
  const handlers = createShopifyOAuthHandlers({ pool: { query: async () => ({ rows: [] }) }, env: ENV });
  const res = response();
  handlers.auth({ query: { shop: 'https://attacker.example/path' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /myshopify/);
});

test('Shopify callback verifies state and HMAC, exchanges code, and encrypts saved credentials', async () => {
  const state = 'a'.repeat(64);
  const query = { shop: 'sample-store.myshopify.com', code: 'oauth-code', state, timestamp: '1794000000' };
  const message = Object.keys(query).sort().map(key => `${key}=${query[key]}`).join('&');
  query.hmac = crypto.createHmac('sha256', SECRET).update(message).digest('hex');
  const saved = [];
  const pool = {
    async query(sql, values) {
      if (sql.includes('SELECT id FROM public.merchants')) return { rows: [{ id: 'merchant-1' }] };
      if (sql.includes('INSERT INTO public.merchant_integrations')) { saved.push(values); return { rows: [] }; }
      throw new Error('Unexpected SQL');
    },
  };
  let exchangeUrl = '';
  const handlers = createShopifyOAuthHandlers({
    pool,
    env: ENV,
    fetchImpl: async (url, options) => {
      exchangeUrl = url;
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
      assert.equal(new URLSearchParams(options.body).get('expiring'), '1');
      return { ok: true, json: async () => ({ access_token: 'shpat-oauth-token', scope: 'read_orders,write_orders', refresh_token: 'shprt-oauth-token', expires_in: 3600, refresh_token_expires_in: 7776000 }) };
    },
  });
  const res = response();
  await handlers.callback({
    query,
    cookies: { kashnode_shopify_oauth_state: state },
    session: {
      user: { id: 'user-1', merchantId: 'merchant-1', role: 'merchant' },
      shopifyOAuthState: { state, userId: 'user-1', merchantId: 'merchant-1', expiresAt: Date.now() + 60000 },
    },
  }, res);

  assert.equal(exchangeUrl, 'https://sample-store.myshopify.com/admin/oauth/access_token');
  assert.equal(saved.length, 1);
  assert.equal(res.redirectUrl, 'https://app.example.com/dashboard/integrations?status=connected');
  assert.equal(res.headers.clearedCookie.name, 'kashnode_shopify_oauth_state');
  const [merchantId, ciphertext, nonce, authTag, keyVersion, configJson] = saved[0];
  assert.equal(merchantId, 'merchant-1');
  assert.deepEqual(JSON.parse(configJson), { shopDomain: 'sample-store.myshopify.com' });
  const credentials = decryptIntegrationCredentials({
    credentials_ciphertext: ciphertext,
    credentials_nonce: nonce,
    credentials_auth_tag: authTag,
    credentials_key_version: keyVersion,
  }, { INTEGRATION_ENCRYPTION_KEY: KEY });
  assert.equal(credentials.shopDomain, 'sample-store.myshopify.com');
  assert.equal(credentials.accessToken, 'shpat-oauth-token');
  assert.equal(credentials.refreshToken, 'shprt-oauth-token');
  assert.ok(Number.isFinite(Date.parse(credentials.accessTokenExpiresAt)));
  assert.ok(Number.isFinite(Date.parse(credentials.refreshTokenExpiresAt)));
  assert.equal(credentials.webhookSecret, SECRET);
  assert.equal(credentials.apiVersion, '2026-10');
});

test('Shopify expiring offline credentials rotate before expiry', async () => {
  const now = 1_800_000_000_000;
  let requestBody;
  const credentials = {
    shopDomain: 'sample-store.myshopify.com',
    accessToken: 'old-access-token',
    refreshToken: 'old-refresh-token',
    accessTokenExpiresAt: new Date(now - 1000).toISOString(),
    refreshTokenExpiresAt: new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString(),
    webhookSecret: SECRET,
    apiVersion: '2026-10',
  };
  const refreshed = await refreshShopifyAccessToken(credentials, {
    env: ENV,
    now,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://sample-store.myshopify.com/admin/oauth/access_token');
      requestBody = new URLSearchParams(options.body);
      return { ok: true, json: async () => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        refresh_token_expires_in: 7776000,
      }) };
    },
  });
  assert.equal(requestBody.get('grant_type'), 'refresh_token');
  assert.equal(requestBody.get('refresh_token'), 'old-refresh-token');
  assert.equal(refreshed.accessToken, 'new-access-token');
  assert.equal(refreshed.refreshToken, 'new-refresh-token');
  assert.ok(Date.parse(refreshed.accessTokenExpiresAt) > now);
  assert.ok(Date.parse(refreshed.refreshTokenExpiresAt) > now);
  assert.equal(refreshed.webhookSecret, SECRET);
});

test('Shopify callback rejects an invalid CSRF state without exchanging a token', async () => {
  let exchanged = false;
  const handlers = createShopifyOAuthHandlers({
    pool: { query: async () => ({ rows: [{ id: 'merchant-1' }] }) },
    env: ENV,
    fetchImpl: async () => { exchanged = true; throw new Error('must not exchange'); },
  });
  const res = response();
  await handlers.callback({
    query: { shop: 'sample-store.myshopify.com', state: 'wrong', code: 'oauth-code', hmac: '0'.repeat(64) },
    cookies: { kashnode_shopify_oauth_state: 'expected' },
    session: {
      user: { id: 'user-1', merchantId: 'merchant-1', role: 'merchant' },
      shopifyOAuthState: { state: 'expected', userId: 'user-1', merchantId: 'merchant-1', expiresAt: Date.now() + 60000 },
    },
  }, res);
  assert.equal(exchanged, false);
  assert.equal(res.redirectUrl, 'https://app.example.com/dashboard/integrations?status=error');
});
