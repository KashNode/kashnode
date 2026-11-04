import test from 'node:test'
import assert from 'node:assert/strict'
import { createCheckLimits } from '../server/middleware/checkLimits.js'

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
  }
}

test('allows a merchant with available orders and attaches current plan data', async () => {
  const middleware = createCheckLimits({
    pool: { query: async () => ({ rows: [{ id: 'merchant-1', subscription_plan: 'free', available_orders: 10 }] }) },
  })
  const req = { session: { user: { merchantId: 'merchant-1' } } }
  const res = response()
  let calledNext = false

  await middleware(req, res, () => { calledNext = true })

  assert.equal(calledNext, true)
  assert.equal(req.merchant.available_orders, 10)
  assert.equal(req.merchant.subscription_plan, 'free')
})

test('returns 403 LIMIT_EXCEEDED when no order quota remains', async () => {
  const middleware = createCheckLimits({
    pool: { query: async () => ({ rows: [{ id: 'merchant-1', subscription_plan: 'free', available_orders: 0 }] }) },
  })
  const req = { session: { user: { merchantId: 'merchant-1' } } }
  const res = response()
  let calledNext = false

  await middleware(req, res, () => { calledNext = true })

  assert.equal(calledNext, false)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.code, 'LIMIT_EXCEEDED')
  assert.equal(res.body.message, 'Limit Exceeded')
})

test('does not accept a merchant ID supplied only in the request body', async () => {
  const middleware = createCheckLimits({ pool: { query: async () => ({ rows: [] }) } })
  const req = { body: { merchantId: 'merchant-1' } }
  const res = response()

  await middleware(req, res, () => assert.fail('next must not be called'))

  assert.equal(res.statusCode, 401)
})
