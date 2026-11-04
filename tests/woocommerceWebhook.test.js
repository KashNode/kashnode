import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import { createWooCommerceWebhookHandler } from '../server/routes/woocommerceWebhook.js'

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111'
const SECRET = 'merchant-webhook-secret'

async function createTestServer(t, { onOrderPersist = async () => {} } = {}) {
  const queries = []
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params })
      if (sql.includes('SELECT webhook_secret')) return { rows: [{ webhook_secret: SECRET }] }
      return { rows: [{ id: 'order-1', payment_status: 'unpaid', delivery_status: 'pending' }] }
    },
  }
  const app = express()
  app.use(express.json({ verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer) } }))
  app.post('/hook/:merchantId', createWooCommerceWebhookHandler({ pool, onOrderPersist }))
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise(resolve => server.close(resolve)))
  await new Promise(resolve => server.once('listening', resolve))
  return { server, queries }
}

function signedRequest(payload, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(Buffer.from(payload)).digest('base64')
}

test('accepts signed WooCommerce payload and persists idempotently with exact total', async t => {
  const reconciledMerchants = []
  const { server, queries } = await createTestServer(t, {
    onOrderPersist: async merchantId => reconciledMerchants.push(merchantId),
  })
  const payload = JSON.stringify({
    id: 1234,
    billing: { phone: '+880 1712-345678', first_name: 'Test', last_name: 'Customer' },
    total: '1050.00',
    shipping_total: '50.00',
    payment_method: 'bKash',
  })
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/hook/' + MERCHANT_ID, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-wc-webhook-signature': signedRequest(payload),
    },
    body: payload,
  })

  assert.equal(response.status, 202)
  const responseBody = await response.json()
  assert.equal(responseBody.order_id, 'order-1')
  assert.equal(responseBody.payment_status, 'unpaid')
  assert.equal(queries.length, 2)
  assert.match(queries[1].sql, /ON CONFLICT \(merchant_id, platform_order_id\) DO UPDATE/)
  assert.doesNotMatch(queries[1].sql.split('DO UPDATE SET')[1], /payment_status\s*=/i)
  assert.deepEqual(queries[1].params, [
    MERCHANT_ID,
    '1234',
    '01712345678',
    'Test Customer',
    '1050.00',
    'bKash',
    null,
  ])
  assert.deepEqual(reconciledMerchants, [MERCHANT_ID])
})

test('stores COD marker so reconciliation can exclude cash-on-delivery orders', async t => {
  const { server, queries } = await createTestServer(t)
  const payload = JSON.stringify({
    id: 1235,
    billing: { phone: '01712345678' },
    total: '500',
    payment_method: 'cod',
    payment_method_title: 'Cash on Delivery',
  })
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/hook/' + MERCHANT_ID, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-wc-webhook-signature': signedRequest(payload) },
    body: payload,
  })

  assert.equal(response.status, 202)
  assert.equal(queries[1].params[5], 'cod')
})

test('rejects an invalid WooCommerce signature without inserting an order', async t => {
  const { server, queries } = await createTestServer(t)
  const payload = JSON.stringify({ id: 1236, billing: { phone: '01712345678' }, total: '500' })
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/hook/' + MERCHANT_ID, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-wc-webhook-signature': signedRequest(payload, 'wrong-secret') },
    body: payload,
  })

  assert.equal(response.status, 401)
  assert.equal(queries.length, 1)
})
