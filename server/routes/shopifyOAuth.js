import crypto from 'node:crypto';
import { encryptIntegrationCredentials } from '../services/integrationCrypto.js';

const STATE_COOKIE = 'kashnode_shopify_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;
const SHOP_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/;

function normalizeShopDomain(value) {
  if (typeof value !== 'string' || value.length > 512) throw new Error('Enter a valid Shopify shop domain.');
  const raw = value.trim().toLowerCase();
  let hostname = raw;
  if (raw.includes('://')) {
    let parsed;
    try { parsed = new URL(raw); } catch { throw new Error('Enter a valid Shopify shop domain.'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || (parsed.port && parsed.port !== '443')
      || (parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash) {
      throw new Error('Use an HTTPS URL for a valid .myshopify.com shop domain only.');
    }
    hostname = parsed.hostname;
  } else if (raw.includes('/') || raw.includes('?') || raw.includes('#') || raw.includes('@') || raw.includes(':')) {
    throw new Error('Enter only your Shopify shop domain.');
  }
  hostname = hostname.replace(/\.$/, '');
  if (!SHOP_PATTERN.test(hostname)) throw new Error('Shop domain must end in .myshopify.com.');
  return hostname;
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function hasRequiredScopes(grantedScopeValue, requestedScopeValue) {
  const granted = new Set(String(grantedScopeValue || '').split(',').map(scope => scope.trim()).filter(Boolean));
  const requested = String(requestedScopeValue || 'read_orders,write_orders').split(',').map(scope => scope.trim()).filter(Boolean);
  return requested.every(scope => granted.has(scope)
    || (scope.startsWith('read_') && granted.has(`write_${scope.slice(5)}`)));
}

function validShopifyHmac(query, secret) {
  const supplied = query.hmac;
  if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const message = Object.keys(query)
    .filter(key => key !== 'hmac')
    .sort()
    .map(key => `${key}=${Array.isArray(query[key]) ? query[key].join(',') : query[key]}`)
    .join('&');
  const expected = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return safeEqual(supplied.toLowerCase(), expected);
}

function appBaseUrl(env) {
  const configured = env.APP_URL || env.PUBLIC_APP_URL || env.FRONTEND_URL;
  if (!configured) throw new Error('APP_URL must be configured for Shopify OAuth.');
  const url = new URL(configured);
  if (url.protocol !== 'https:' && env.NODE_ENV === 'production') throw new Error('APP_URL must use HTTPS in production.');
  return url.origin;
}

function cookieOptions(isProduction) {
  return { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/api/merchant/integrations/shopify', maxAge: STATE_TTL_MS };
}

export function createShopifyOAuthHandlers({ pool, env = process.env, fetchImpl = fetch } = {}) {
  function auth(req, res) {
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'Integrations are unavailable.' });
    const clientId = env.SHOPIFY_CLIENT_ID;
    const clientSecret = env.SHOPIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return res.status(503).json({ status: 'error', message: 'Shopify OAuth is not configured.' });
    let shop;
    try { shop = normalizeShopDomain(req.query.shop); } catch (error) {
      return res.status(400).json({ status: 'error', message: error.message });
    }
    let redirectUri;
    try { redirectUri = `${appBaseUrl(env)}/api/merchant/integrations/shopify/callback`; } catch {
      return res.status(503).json({ status: 'error', message: 'Shopify OAuth callback URL is not configured.' });
    }
    const state = crypto.randomBytes(32).toString('hex');
    req.session.shopifyOAuthState = {
      state,
      userId: String(req.session.user.id),
      merchantId: String(req.session.user.merchantId),
      expiresAt: Date.now() + STATE_TTL_MS,
    };
    const scopes = String(env.SHOPIFY_SCOPES || 'read_orders,write_orders').split(',').map(scope => scope.trim()).filter(Boolean).join(',');
    res.cookie(STATE_COOKIE, state, cookieOptions(env.NODE_ENV === 'production'));
    const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('scope', scopes);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', state);
    return res.redirect(302, authorizeUrl.toString());
  }

  async function callback(req, res) {
    const options = cookieOptions(env.NODE_ENV === 'production');
    const finish = status => {
      res.clearCookie(STATE_COOKIE, { ...options, maxAge: undefined });
      return res.redirect(302, `${appBaseUrl(env)}/dashboard/integrations?status=${status}`);
    };
    try {
      if (!pool?.query) return res.status(503).send('Integrations are unavailable.');
      const clientId = env.SHOPIFY_CLIENT_ID;
      const clientSecret = env.SHOPIFY_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.status(503).send('Shopify OAuth is not configured.');
      const user = req.session?.user;
      if (!user?.id || !user?.merchantId || user.role === 'admin') return res.status(401).send('Merchant authentication required. Restart Shopify connection from your dashboard.');
      const shop = normalizeShopDomain(req.query.shop);
      const state = req.query.state;
      const cookieState = req.cookies?.[STATE_COOKIE];
      const sessionState = req.session?.shopifyOAuthState;
      const validState = safeEqual(state, cookieState)
        && safeEqual(state, sessionState?.state)
        && Number(sessionState?.expiresAt) > Date.now()
        && sessionState?.userId === String(user.id)
        && sessionState?.merchantId === String(user.merchantId);
      delete req.session.shopifyOAuthState;
      if (!validState) return finish('error');
      if (!validShopifyHmac(req.query, clientSecret)) return finish('error');
      if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 2048) return finish('error');

      const merchantResult = await pool.query(
        'SELECT id FROM public.merchants WHERE id = $1 AND owner_user_id = $2 LIMIT 1',
        [String(user.merchantId), String(user.id)],
      );
      if (!merchantResult.rows[0]) return finish('error');

      const tokenBody = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: req.query.code, expiring: '1' });
      const tokenResponse = await fetchImpl(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        redirect: 'error',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
        signal: AbortSignal.timeout(12000),
      });
      if (!tokenResponse.ok) return finish('error');
      const tokenPayload = await tokenResponse.json();
      if (typeof tokenPayload.access_token !== 'string' || !tokenPayload.access_token
        || typeof tokenPayload.scope !== 'string' || !hasRequiredScopes(tokenPayload.scope, env.SHOPIFY_SCOPES)
        || typeof tokenPayload.refresh_token !== 'string' || !tokenPayload.refresh_token
        || !Number.isFinite(Number(tokenPayload.expires_in)) || Number(tokenPayload.expires_in) <= 0
        || !Number.isFinite(Number(tokenPayload.refresh_token_expires_in)) || Number(tokenPayload.refresh_token_expires_in) <= 0) return finish('error');

      const credentials = encryptIntegrationCredentials({
        shopDomain: shop,
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token,
        accessTokenExpiresAt: new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + Number(tokenPayload.refresh_token_expires_in) * 1000).toISOString(),
        webhookSecret: clientSecret,
        apiVersion: env.SHOPIFY_API_VERSION || '2026-10',
      }, env);
      await pool.query(
        `INSERT INTO public.merchant_integrations
          (merchant_id, provider, credentials_ciphertext, credentials_nonce, credentials_auth_tag,
           credentials_key_version, config, is_active, last_tested_at, last_test_status, last_test_message, updated_at)
         VALUES ($1, 'shopify', $2, $3, $4, $5, $6::jsonb, TRUE, NOW(), 'connected',
           'Shopify OAuth connected.', NOW())
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
        [String(user.merchantId), credentials.ciphertext, credentials.nonce, credentials.authTag,
          credentials.keyVersion, JSON.stringify({ shopDomain: shop })],
      );
      return finish('connected');
    } catch {
      try { return finish('error'); } catch { return res.redirect(302, '/dashboard/integrations?status=error'); }
    }
  }

  return { auth, callback };
}
