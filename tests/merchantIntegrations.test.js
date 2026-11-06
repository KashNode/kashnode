import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptIntegrationCredentials, decryptIntegrationCredentials } from '../server/services/integrationCrypto.js';
import { validateIntegrationCredentials } from '../server/services/integrationProviderService.js';

const KEY = Buffer.alloc(32, 7).toString('base64');

test('integration credentials are encrypted and round-trip with AES-256-GCM', () => {
  const credentials = { apiKey: 'merchant-api-key', secretKey: 'merchant-secret' };
  const encrypted = encryptIntegrationCredentials(credentials, { INTEGRATION_ENCRYPTION_KEY: KEY });
  assert.notEqual(encrypted.ciphertext.toString('utf8'), JSON.stringify(credentials));
  assert.equal(encrypted.nonce.length, 12);
  assert.equal(encrypted.authTag.length, 16);
  assert.deepEqual(
    decryptIntegrationCredentials({
      credentials_ciphertext: encrypted.ciphertext,
      credentials_nonce: encrypted.nonce,
      credentials_auth_tag: encrypted.authTag,
      credentials_key_version: encrypted.keyVersion,
    }, { INTEGRATION_ENCRYPTION_KEY: KEY }),
    credentials,
  );
});

test('integration credential encryption rejects missing or invalid key material', () => {
  assert.throws(() => encryptIntegrationCredentials({ secret: 'x' }, {}), /INTEGRATION_ENCRYPTION_KEY/);
  assert.throws(() => encryptIntegrationCredentials({ secret: 'x' }, { INTEGRATION_ENCRYPTION_KEY: 'short' }), /32-byte/);
});

test('tampered integration ciphertext fails authenticated decryption', () => {
  const encrypted = encryptIntegrationCredentials({ token: 'private' }, { INTEGRATION_ENCRYPTION_KEY: KEY });
  encrypted.ciphertext[0] ^= 1;
  assert.throws(() => decryptIntegrationCredentials({
    credentials_ciphertext: encrypted.ciphertext,
    credentials_nonce: encrypted.nonce,
    credentials_auth_tag: encrypted.authTag,
    credentials_key_version: encrypted.keyVersion,
  }, { INTEGRATION_ENCRYPTION_KEY: KEY }));
});

test('provider credential validation requires the complete secret set', () => {
  assert.throws(() => validateIntegrationCredentials('steadfast', { apiKey: 'only-one' }), /required/);
  assert.throws(() => validateIntegrationCredentials('pathao', { clientId: 'id' }), /required/);
  assert.throws(() => validateIntegrationCredentials('woocommerce', { storeUrl: 'https://shop.example.com' }), /required/);
  assert.throws(() => validateIntegrationCredentials('shopify', { shopDomain: 'example.com', accessToken: 'token' }), /myshopify/);
});

test('provider credential validation normalizes safe provider settings', () => {
  assert.deepEqual(
    validateIntegrationCredentials('pathao', {
      environment: 'sandbox', clientId: 'id', clientSecret: 'secret',
      username: 'merchant@example.com', password: 'pass', storeId: '42',
    }),
    {
      environment: 'sandbox', baseUrl: 'https://courier-api-sandbox.pathao.com',
      clientId: 'id', clientSecret: 'secret', username: 'merchant@example.com',
      password: 'pass', storeId: 42,
    },
  );
  assert.equal(
    validateIntegrationCredentials('shopify', { shopDomain: 'shop.myshopify.com', accessToken: 'token', webhookSecret: 'webhook-secret' }).apiVersion,
    '2026-10',
  );
});
