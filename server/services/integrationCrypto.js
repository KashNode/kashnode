import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_VERSION = 1;

function readEncryptionKey(env = process.env) {
  const raw = env.INTEGRATION_ENCRYPTION_KEY;
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be configured before merchant integrations can be used.');
  }
  const value = raw.trim();
  let key;
  if (/^[a-f0-9]{64}$/i.test(value)) key = Buffer.from(value, 'hex');
  else key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key.');
  }
  return key;
}

export function encryptIntegrationCredentials(credentials, env = process.env) {
  const key = readEncryptionKey(env);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce);
  const plaintext = Buffer.from(JSON.stringify(credentials), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext,
    nonce,
    authTag: cipher.getAuthTag(),
    keyVersion: KEY_VERSION,
  };
}

export function decryptIntegrationCredentials(row, env = process.env) {
  if (Number(row.credentials_key_version) !== KEY_VERSION) {
    throw new Error('Unsupported integration credential encryption key version.');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    readEncryptionKey(env),
    Buffer.from(row.credentials_nonce),
  );
  decipher.setAuthTag(Buffer.from(row.credentials_auth_tag));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(row.credentials_ciphertext)),
    decipher.final(),
  ]).toString('utf8');
  const parsed = JSON.parse(plaintext);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Stored integration credentials are invalid.');
  }
  return parsed;
}
