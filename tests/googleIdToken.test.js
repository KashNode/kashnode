import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { clearGoogleKeyCache, verifyGoogleIdToken } from '../server/services/googleIdToken.js'

const now = 1_800_000_000_000
const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const publicJwk = { ...keyPair.publicKey.export({ format: 'jwk' }), kid: 'kashnode-test-key', alg: 'RS256', use: 'sig' }

function makeToken(overrides = {}, privateKey = keyPair.privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'kashnode-test-key', typ: 'JWT' })).toString('base64url')
  const claims = Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com',
    aud: 'kashnode-google-client-id',
    sub: 'google-sub-123',
    email: 'owner@shop.example',
    email_verified: true,
    name: 'Shop Owner',
    nonce: 'session-challenge',
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600,
    ...overrides,
  })).toString('base64url')
  const signingInput = `${header}.${claims}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url')
  return `${signingInput}.${signature}`
}

function mockFetch() {
  return async () => new Response(JSON.stringify({ keys: [publicJwk] }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  })
}

test('verifies Google signature, audience, issuer, expiry and verified email', async () => {
  clearGoogleKeyCache()
  const identity = await verifyGoogleIdToken(makeToken(), {
    clientId: 'kashnode-google-client-id',
    fetchImpl: mockFetch(),
    now: () => now,
  })

  assert.deepEqual(identity, {
    sub: 'google-sub-123',
    nonce: 'session-challenge',
    email: 'owner@shop.example',
    name: 'Shop Owner',
    picture: null,
  })
})

test('rejects expired Google ID tokens', async () => {
  clearGoogleKeyCache()
  await assert.rejects(
    verifyGoogleIdToken(makeToken({ exp: Math.floor(now / 1000) - 1 }), {
      clientId: 'kashnode-google-client-id',
      fetchImpl: mockFetch(),
      now: () => now,
    }),
    /expired/,
  )
})

test('rejects unverified Google email claims', async () => {
  clearGoogleKeyCache()
  await assert.rejects(
    verifyGoogleIdToken(makeToken({ email_verified: false }), {
      clientId: 'kashnode-google-client-id',
      fetchImpl: mockFetch(),
      now: () => now,
    }),
    /confirm the email/,
  )
})

test('rejects a token signed by a key not published by Google', async () => {
  clearGoogleKeyCache()
  const attacker = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  await assert.rejects(
    verifyGoogleIdToken(makeToken({}, attacker.privateKey), {
      clientId: 'kashnode-google-client-id',
      fetchImpl: mockFetch(),
      now: () => now,
    }),
    /signature is invalid/,
  )
})
