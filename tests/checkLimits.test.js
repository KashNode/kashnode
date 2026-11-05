import test from 'node:test'
import assert from 'node:assert/strict'
import { createCheckWallet } from '../server/middleware/checkLimits.js'

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
  }
}

test('allows positive wallet balance', async () => {
  const middleware = createCheckWallet({ pool: { query: async () => ({ rows: [{ id: 'm1', wallet_balance: '125.50', available_voice_minutes: 0 }] }) } })
  const req = { session: { user: { merchantId: 'm1' } } }
  const res = response()
  let nextCalled = false
  await middleware(req, res, () => { nextCalled = true })
  assert.equal(nextCalled, true)
  assert.equal(req.merchant.wallet_balance, 125.5)
})

test('allows prepaid voice minutes when wallet balance is zero', async () => {
  const middleware = createCheckWallet({ pool: { query: async () => ({ rows: [{ id: 'm1', wallet_balance: 0, available_voice_minutes: 8 }] }) } })
  const req = { session: { user: { merchantId: 'm1' } } }
  const res = response()
  let nextCalled = false
  await middleware(req, res, () => { nextCalled = true })
  assert.equal(nextCalled, true)
  assert.equal(req.merchant.available_voice_minutes, 8)
})

test('returns 402 when wallet and prepaid voice minutes are exhausted', async () => {
  const middleware = createCheckWallet({ pool: { query: async () => ({ rows: [{ id: 'm1', wallet_balance: 0, available_voice_minutes: 0 }] }) } })
  const req = { session: { user: { merchantId: 'm1' } } }
  const res = response()
  await middleware(req, res, () => assert.fail('unexpected next'))
  assert.equal(res.statusCode, 402)
  assert.equal(res.body.code, 'INSUFFICIENT_VOICE_CREDIT')
})

test('does not trust merchant ID supplied only in request body', async () => {
  const middleware = createCheckWallet({ pool: { query: async () => ({ rows: [] }) } })
  const req = { body: { merchantId: 'm1' } }
  const res = response()
  await middleware(req, res, () => assert.fail('unexpected next'))
  assert.equal(res.statusCode, 401)
})
