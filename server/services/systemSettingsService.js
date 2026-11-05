const SUPPORTED_PROVIDERS = Object.freeze(['openai', 'gemini', 'groq']);

const PROVIDER_CONFIG = Object.freeze({
  openai: {
    column: 'openai_api_key_secret_id',
    secretName: 'kashnode_openai_api_key',
    description: 'Super Admin-managed OpenAI API key for KashNode voice generation.',
  },
  gemini: {
    column: 'gemini_api_key_secret_id',
    secretName: 'kashnode_gemini_api_key',
    description: 'Super Admin-managed Gemini API key for KashNode voice generation.',
  },
  groq: {
    column: 'groq_api_key_secret_id',
    secretName: 'kashnode_groq_api_key',
    description: 'Super Admin-managed Groq API key for KashNode voice generation.',
  },
});

const SETTINGS_SELECT = [
  'SELECT settings.id, settings.active_llm_provider, settings.default_voice_rate,',
  ' settings.openai_api_key_secret_id, settings.gemini_api_key_secret_id, settings.groq_api_key_secret_id, settings.updated_at,',
  ' openai.decrypted_secret AS openai_api_key, gemini.decrypted_secret AS gemini_api_key, groq.decrypted_secret AS groq_api_key',
  'FROM public.system_settings AS settings',
  'LEFT JOIN vault.decrypted_secrets AS openai ON openai.id = settings.openai_api_key_secret_id',
  'LEFT JOIN vault.decrypted_secrets AS gemini ON gemini.id = settings.gemini_api_key_secret_id',
  'LEFT JOIN vault.decrypted_secrets AS groq ON groq.id = settings.groq_api_key_secret_id',
  'WHERE settings.id = 1',
].join('\n');

export class SystemSettingsError extends Error {
  constructor(message, status = 400, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'SystemSettingsError';
    this.status = status;
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanProviderKey(value, provider) {
  if (typeof value !== 'string') {
    throw new SystemSettingsError(provider + ' API key must be a string.');
  }
  const key = value.trim();
  if (!key) return null;
  if (key.length > 4096 || /[\u0000-\u001f\u007f]/.test(key)) {
    throw new SystemSettingsError(provider + ' API key is invalid or too long.');
  }
  return key;
}

function sanitizeSettings(row) {
  const apiKeys = {};
  for (const provider of SUPPORTED_PROVIDERS) {
    const secret = typeof row?.[provider + '_api_key'] === 'string'
      ? row[provider + '_api_key']
      : '';
    apiKeys[provider] = {
      configured: secret.length > 0,
      maskedSuffix: secret.length > 0 ? '••••' + secret.slice(-4) : null,
    };
  }

  return {
    activeLlmProvider: row?.active_llm_provider || 'openai',
    defaultVoiceRate: Number(row?.default_voice_rate ?? 7),
    apiKeys,
    updatedAt: row?.updated_at || null,
  };
}

async function readSettingsRow(queryable) {
  const result = await queryable.query(SETTINGS_SELECT);
  return result.rows?.[0] || null;
}

export async function getAdminSystemSettings({ pool } = {}) {
  if (!pool?.query) throw new SystemSettingsError('Database connection is unavailable.', 503);
  const row = await readSettingsRow(pool);
  return sanitizeSettings(row);
}

/**
 * Save provider/rate settings and provider keys atomically.
 * Key material is written to Supabase Vault, never to the public settings row.
 */
export async function updateAdminSystemSettings({ pool, adminUserId, body } = {}) {
  if (!pool?.connect) throw new SystemSettingsError('Database connection is unavailable.', 503);
  if (!isRecord(body)) throw new SystemSettingsError('Settings payload must be a JSON object.');

  const activeLlmProvider = body.activeLlmProvider;
  if (activeLlmProvider !== undefined && !SUPPORTED_PROVIDERS.includes(activeLlmProvider)) {
    throw new SystemSettingsError('Choose OpenAI, Gemini, or Groq as the active AI provider.');
  }

  let defaultVoiceRate;
  if (body.defaultVoiceRate !== undefined) {
    defaultVoiceRate = Number(body.defaultVoiceRate);
    if (!Number.isFinite(defaultVoiceRate) || defaultVoiceRate < 0 || defaultVoiceRate > 10000) {
      throw new SystemSettingsError('Default voice rate must be between ৳0 and ৳10,000 per minute.');
    }
    defaultVoiceRate = defaultVoiceRate.toFixed(2);
  }

  const suppliedKeys = body.apiKeys === undefined ? {} : body.apiKeys;
  if (!isRecord(suppliedKeys)) throw new SystemSettingsError('API keys must be provided as an object.');
  for (const provider of Object.keys(suppliedKeys)) {
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new SystemSettingsError('Unsupported API key provider: ' + provider + '.');
    }
  }

  const clearApiKeys = body.clearApiKeys === undefined ? [] : body.clearApiKeys;
  if (!Array.isArray(clearApiKeys)
    || clearApiKeys.some(provider => !SUPPORTED_PROVIDERS.includes(provider))
    || new Set(clearApiKeys).size !== clearApiKeys.length) {
    throw new SystemSettingsError('clearApiKeys must contain unique provider names.');
  }

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;

    let settingsResult = await client.query(
      'SELECT id, active_llm_provider, default_voice_rate, openai_api_key_secret_id, gemini_api_key_secret_id, groq_api_key_secret_id FROM public.system_settings WHERE id = 1 FOR UPDATE',
    );
    let settings = settingsResult.rows?.[0];

    if (!settings) {
      settingsResult = await client.query(
        'INSERT INTO public.system_settings (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id RETURNING id, active_llm_provider, default_voice_rate, openai_api_key_secret_id, gemini_api_key_secret_id, groq_api_key_secret_id',
      );
      settings = settingsResult.rows[0];
    }

    const nextProvider = activeLlmProvider ?? settings.active_llm_provider;
    const nextRate = defaultVoiceRate ?? String(settings.default_voice_rate);
    const nextSecretIds = {};

    for (const provider of SUPPORTED_PROVIDERS) {
      const metadata = PROVIDER_CONFIG[provider];
      const previousSecretId = settings[metadata.column];
      nextSecretIds[metadata.column] = previousSecretId;

      if (clearApiKeys.includes(provider)) {
        if (previousSecretId) {
          await client.query(
            'SELECT vault.update_secret($1::uuid, $2::text)',
            [previousSecretId, ''],
          );
        }
        continue;
      }

      if (!Object.prototype.hasOwnProperty.call(suppliedKeys, provider)) continue;
      const newSecret = cleanProviderKey(suppliedKeys[provider], provider);
      if (!newSecret) continue;

      if (previousSecretId) {
        await client.query(
          'SELECT vault.update_secret($1::uuid, $2::text)',
          [previousSecretId, newSecret],
        );
      } else {
        const createdSecret = await client.query(
          'SELECT vault.create_secret($1::text, $2::text, $3::text) AS id',
          [newSecret, metadata.secretName, metadata.description],
        );
        const newId = createdSecret.rows?.[0]?.id;
        if (!newId) throw new SystemSettingsError('Could not store the ' + provider + ' API key in Vault.', 500);
        nextSecretIds[metadata.column] = newId;
      }
    }

    await client.query(
      'UPDATE public.system_settings SET active_llm_provider = $1, default_voice_rate = $2::numeric, openai_api_key_secret_id = $3::uuid, gemini_api_key_secret_id = $4::uuid, groq_api_key_secret_id = $5::uuid, updated_by = $6::uuid, updated_at = NOW() WHERE id = 1',
      [
        nextProvider,
        nextRate,
        nextSecretIds.openai_api_key_secret_id,
        nextSecretIds.gemini_api_key_secret_id,
        nextSecretIds.groq_api_key_secret_id,
        adminUserId || null,
      ],
    );

    await client.query('COMMIT');
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {});
    if (error instanceof SystemSettingsError) throw error;
    throw new SystemSettingsError('Could not save system settings. Check the Vault and database permissions.', 500, error);
  } finally {
    client.release();
  }

  return getAdminSystemSettings({ pool });
}

/**
 * Read the Super Admin-selected provider and decrypt only inside the trusted
 * Node backend. Environment variables remain a backward-compatible fallback.
 */
export async function getRuntimeSystemSettings({ pool, env = process.env } = {}) {
  const fallbackProvider = String(env.VOICE_LLM_PROVIDER || 'openai').trim().toLowerCase();
  const providerFromEnv = SUPPORTED_PROVIDERS.includes(fallbackProvider) ? fallbackProvider : 'openai';
  const fallback = {
    activeLlmProvider: providerFromEnv,
    defaultVoiceRate: Number(env.DEFAULT_VOICE_RATE || 7),
    env: { ...env },
  };

  if (!pool?.query) return fallback;

  let row;
  try {
    row = await readSettingsRow(pool);
  } catch (error) {
    if (error?.code === '42P01') return fallback;
    throw error;
  }
  if (!row) return fallback;

  const runtimeEnv = { ...env };
  const openaiKey = row.openai_api_key || env.OPENAI_API_KEY || '';
  const geminiKey = row.gemini_api_key || env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '';
  const groqKey = row.groq_api_key || env.GROQ_API_KEY || '';

  if (openaiKey) runtimeEnv.OPENAI_API_KEY = openaiKey;
  if (geminiKey) {
    runtimeEnv.GEMINI_API_KEY = geminiKey;
    runtimeEnv.GOOGLE_API_KEY = geminiKey;
  }
  if (groqKey) runtimeEnv.GROQ_API_KEY = groqKey;

  return {
    activeLlmProvider: SUPPORTED_PROVIDERS.includes(row.active_llm_provider)
      ? row.active_llm_provider
      : providerFromEnv,
    defaultVoiceRate: Number(row.default_voice_rate ?? 7),
    env: runtimeEnv,
  };
}

export { SUPPORTED_PROVIDERS };
