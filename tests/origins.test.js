import test from 'node:test'
import assert from 'node:assert/strict'
import { createAllowedOrigins, isAllowedOrigin, normalizeOrigin } from '../server/utils/origins.js'

test('allows the KashNode apex and www custom domains in production', () => {
  const allowed = createAllowedOrigins({ NODE_ENV: 'production' })
  assert.equal(isAllowedOrigin('https://kashnode.com', allowed), true)
  assert.equal(isAllowedOrigin('https://www.kashnode.com', allowed), true)
  assert.equal(isAllowedOrigin('http://kashnode.com', allowed), false)
})

test('allows configured frontend, Render and additional comma-separated origins', () => {
  const allowed = createAllowedOrigins({
    NODE_ENV: 'production',
    FRONTEND_ORIGIN: 'https://console.kashnode.com/',
    RENDER_EXTERNAL_URL: 'https://kashnode.onrender.com',
    CORS_ALLOWED_ORIGINS: 'https://staging.kashnode.com, https://preview.kashnode.com/',
  })
  assert.equal(isAllowedOrigin('https://console.kashnode.com', allowed), true)
  assert.equal(isAllowedOrigin('https://kashnode.onrender.com', allowed), true)
  assert.equal(isAllowedOrigin('https://staging.kashnode.com', allowed), true)
  assert.equal(isAllowedOrigin('https://preview.kashnode.com', allowed), true)
})

test('only adds localhost development origins outside production', () => {
  const production = createAllowedOrigins({ NODE_ENV: 'production' })
  const development = createAllowedOrigins({ NODE_ENV: 'development' })
  assert.equal(isAllowedOrigin('http://localhost:5173', production), false)
  assert.equal(isAllowedOrigin('http://localhost:5173', development), true)
  assert.equal(isAllowedOrigin('http://127.0.0.1:5173', development), true)
})

test('rejects malformed origins and lookalike domains', () => {
  const allowed = createAllowedOrigins({ NODE_ENV: 'production' })
  assert.equal(isAllowedOrigin('https://kashnode.com.evil.example', allowed), false)
  assert.equal(isAllowedOrigin('javascript://kashnode.com', allowed), false)
  assert.equal(isAllowedOrigin('not-a-url', allowed), false)
  assert.equal(normalizeOrigin('https://kashnode.com/path?x=1'), 'https://kashnode.com')
})

test('allows missing Origin only when the caller explicitly requests it', () => {
  const allowed = createAllowedOrigins({ NODE_ENV: 'production' })
  assert.equal(isAllowedOrigin(undefined, allowed), false)
  assert.equal(isAllowedOrigin(undefined, allowed, { allowMissing: true }), true)
})
