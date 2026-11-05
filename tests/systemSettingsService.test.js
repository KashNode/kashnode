import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdminSystemSettings,
  getRuntimeSystemSettings,
  updateAdminSystemSettings,
  SystemSettingsError,
} from '../server/services/systemSettingsService.js';

function makeSettingsRow(overrides = {}) {
  return {
    active_llm_provider: 'gemini',
    default_voice_rate: '4.50',
    openai_api_key: '',
    gemini_api_key: 'gemini-super-secret-1234',
    groq_api_key: null,
    updated_at: '2026-11-05T10:00:00.000Z',
    ...overrides,
  };
}

test('admin settings only return provider key state and a masked suffix', async () => {
  const pool = {
    async query() {
      return { rows: [makeSettingsRow()] };
    },
  };

  const settings = await getAdminSystemSettings({ pool });

  assert.equal(settings.activeLlmProvider, 'gemini');
  assert.equal(settings.defaultVoiceRate, 4.5);
  assert.equal(settings.apiKeys.gemini.configured, true);
  assert.equal(settings.apiKeys.gemini.maskedSuffix, '••••1234');
  assert.equal(settings.apiKeys.openai.configured, false);
  assert.equal(JSON.stringify(settings).includes('gemini-super-secret-1234'), false);
});

test('runtime settings prefer the active provider and Vault key over env fallbacks', async () => {
  const pool = {
    async query() {
      return {
        rows: [makeSettingsRow({
          active_llm_provider: 'groq',
          groq_api_key: 'groq-vault-key',
        })],
      };
    },
  };

  const runtime = await getRuntimeSystemSettings({
    pool,
    env: { VOICE_LLM_PROVIDER: 'openai', GROQ_API_KEY: 'old-env-key' },
  });

  assert.equal(runtime.activeLlmProvider, 'groq');
  assert.equal(runtime.defaultVoiceRate, 4.5);
  assert.equal(runtime.env.GROQ_API_KEY, 'groq-vault-key');
  assert.equal(runtime.env.VOICE_LLM_PROVIDER, 'openai');
});

test('runtime settings fall back to environment when the table is not deployed locally', async () => {
  const pool = {
    async query() {
      const error = new Error('relation does not exist');
      error.code = '42P01';
      throw error;
    },
  };

  const runtime = await getRuntimeSystemSettings({
    pool,
    env: { VOICE_LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'env-key' },
  });

  assert.equal(runtime.activeLlmProvider, 'gemini');
  assert.equal(runtime.env.GEMINI_API_KEY, 'env-key');
});

test('rejects unsupported providers before opening a transaction', async () => {
  let connected = false;
  await assert.rejects(
    updateAdminSystemSettings({
      pool: { async connect() { connected = true; } },
      adminUserId: '00000000-0000-4000-8000-000000000001',
      body: { activeLlmProvider: 'unsupported' },
    }),
    SystemSettingsError,
  );
  assert.equal(connected, false);
});
