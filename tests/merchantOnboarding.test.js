import test from 'node:test';
import assert from 'node:assert/strict';
import { createMerchantOnboardingHandlers } from '../server/routes/merchant.js';

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const identity = {
  session: {
    user: {
      id: 'user-uuid',
      merchantId: 'merchant-uuid',
      role: 'user',
    },
  },
};

test('GET onboarding returns only the authenticated owner merchant profile', async () => {
  let queryArgs;
  const handlers = createMerchantOnboardingHandlers({
    pool: {
      async query(_sql, args) {
        queryArgs = args;
        return {
          rows: [{
            is_onboarding_complete: false,
            business_name: 'Kash Shop',
            website_url: null,
            admin_contact_phone: '01712345678',
            box_sim_phone: '',
          }],
        };
      },
    },
  });
  const res = makeResponse();

  await handlers.getOnboarding({ ...identity }, res);

  assert.deepEqual(queryArgs, ['merchant-uuid', 'user-uuid']);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.onboarding.isOnboardingComplete, false);
  assert.equal(res.body.onboarding.businessName, 'Kash Shop');
});

test('POST onboarding validates and saves normalized merchant details', async () => {
  let queryArgs;
  let queryCount = 0;
  const handlers = createMerchantOnboardingHandlers({
    pool: {
      async query(_sql, args) {
        queryArgs = args;
        queryCount += 1;
        if (queryCount === 1) return { rows: [{ billing_phone: '01712345678', is_billing_phone_verified: true }] };
        return {
          rows: [{
            is_onboarding_complete: true,
            business_name: 'Dhaka Fashion House',
            website_url: 'https://example.com/',
            admin_contact_phone: '01712345678',
            box_sim_phone: '01812345678',
          }],
        };
      },
    },
  });
  const res = makeResponse();

  await handlers.postOnboarding({
    ...identity,
    body: {
      businessName: '  Dhaka   Fashion House ',
      websiteUrl: 'https://example.com',
      adminContactPhone: '+880 1712-345678',
      boxSimPhone: '01812345678',
    },
  }, res);

  assert.deepEqual(queryArgs, [
    'merchant-uuid',
    'user-uuid',
    'Dhaka Fashion House',
    'https://example.com/',
    '01712345678',
    '01812345678',
    'android_app',
    'app',
  ]);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.onboarding.isOnboardingComplete, true);
});

test('POST onboarding rejects invalid phone numbers without touching the database', async () => {
  let calls = 0;
  const handlers = createMerchantOnboardingHandlers({
    pool: { async query() { calls += 1; return { rows: [] }; } },
  });
  const res = makeResponse();

  await handlers.postOnboarding({
    ...identity,
    body: {
      businessName: 'Test Store',
      websiteUrl: '',
      adminContactPhone: '12345',
      boxSimPhone: '01812345678',
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls, 0);
});

test('merchant credentials stay unavailable until onboarding is complete', async () => {
  const handlers = createMerchantOnboardingHandlers({
    pool: {
      async query() {
        return { rows: [{ webhook_secret: 'secret-value', is_onboarding_complete: false }] };
      },
    },
  });
  const res = makeResponse();

  await handlers.getCredentials({ ...identity }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.merchantSecretKey, undefined);
});


test('completed merchant owner can retrieve the integration secret', async () => {
  let queryArgs;
  const handlers = createMerchantOnboardingHandlers({
    pool: {
      async query(_sql, args) {
        queryArgs = args;
        return { rows: [{ webhook_secret: 'private-merchant-secret', is_onboarding_complete: true }] };
      },
    },
  });
  const res = makeResponse();

  await handlers.getCredentials({ ...identity }, res);

  assert.deepEqual(queryArgs, ['merchant-uuid', 'user-uuid']);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.merchantSecretKey, 'private-merchant-secret');
});

test('onboarding cannot be submitted without a merchant-bound session', async () => {
  let calls = 0;
  const handlers = createMerchantOnboardingHandlers({
    pool: { async query() { calls += 1; return { rows: [] }; } },
  });
  const res = makeResponse();

  await handlers.postOnboarding({
    session: { user: { id: 'user-uuid', role: 'user' } },
    body: {
      businessName: 'Test Store',
      adminContactPhone: '01712345678',
      boxSimPhone: '01812345678',
    },
  }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(calls, 0);
});
