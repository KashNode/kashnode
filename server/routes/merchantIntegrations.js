import { encryptIntegrationCredentials } from '../services/integrationCrypto.js';
import { validateIntegrationCredentials, testProviderCredentials, requestShopifyClientCredentialsToken, normalizeShopifyDomain } from '../services/integrationProviderService.js';

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

      const credentials = await requestShopifyClientCredentialsToken(
        { shopDomain, clientId, clientSecret },
        { fetchImpl },
      );
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

  return { list, connectShopify, test, save, remove };
}
