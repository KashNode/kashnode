import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import { createShopifyWebhookHandler } from '../server/routes/shopifyWebhook.js'

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111'
const SHOP_DOMAIN = 'test-shop.myshopify.com'
const SECRET = 'shopify-merchant-webhook-secret'

async function createTestServer(t, { initialQuota = 10, failInsert = false, onOrderPersist = async () => {} } = {}) {
  const queries = []
  const state = { availableOrders: initialQuota, orders: new Map(), nextId: 0 }
  const client = {
    snapshot: null,
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\\s+/g, ' ').trim()
      queries.push({ sql: normalized, params })
      if (normalized === 'BEGIN') {
        this.snapshot = {
          availableOrders: state.availableOrders,
          orders: new Map([...state.orders.entries()].map(([key, value]) => [key, structuredClone(value)])),
          nextId: state.nextId,
        }
        return { rows: [] }
      }
      if (normalized === 'COMMIT') { this.snapshot = null; return { rows: [] } }
      if (normalized === 'ROLLBACK') {
        if (this.snapshot) {
          state.availableOrders = this.snapshot.availableOrders
          state.orders = this.snapshot.orders
          state.nextId = this.snapshot.nextId
          this.snapshot = null
        }
        return { rows: [] }
      }
      if (normalized.startsWith('SELECT id FROM public.merchants')) return { rows: [{ id: MERCHANT_ID }] }
      if (normalized.startsWith('SELECT id, payment_status, delivery_status FROM public.orders')) {
        const order = state.orders.get(`${params[0]}:${params[1]}`)
        return { rows: order ? [{ id: order.id, payment_status: order.payment_status, delivery_status: order.delivery_status }] : [] }
      }
      if (normalized.startsWith('UPDATE public.merchants SET available_orders')) {
        if (state.availableOrders <= 0) return { rows: [], rowCount: 0 }
        state.availableOrders -= 1
        return { rows: [{ available_orders: state.availableOrders }], rowCount: 1 }
      }
      if (normalized.startsWith('INSERT INTO public.orders')) {
        if (failInsert) throw new Error('simulated insert failure')
        const key = `${params[0]}:${params[1]}`
        if (state.orders.has(key)) throw new Error('duplicate order')
        state.nextId += 1
        const order = {
          id: `shopify-order-${state.nextId}`,
          merchant_id: params[0],
          platform_order_id: params[1],
          customer_phone: params[2],
          customer_name: params[3],
          total_amount: params[4],
          payment_status: params[5],
          payment_method: params[6],
          line_items: JSON.parse(params[7]),
          financial_status: params[8],
          currency: params[9],
          delivery_status: 'pending',
        }
        state.orders.set(key, order)
        return { rows: [{ id: order.id, payment_status: order.payment_status, delivery_status: order.delivery_status }], rowCount: 1 }
      }
      if (normalized.startsWith('UPDATE public.orders SET customer_phone')) {
        const order = [...state.orders.values()].find(value => value.id === params[0])
        if (!order) return { rows: [], rowCount: 0 }
        Object.assign(order, {
          customer_phone: params[1], customer_name: params[2], total_amount: params[3],
          payment_method: params[4], line_items: JSON.parse(params[5]),
          financial_status: params[6], currency: params[7],
        })
        if (!(order.payment_status === 'paid' && params[8] === 'unpaid')) order.payment_status = params[8]
        return { rows: [{ id: order.id, payment_status: order.payment_status, delivery_status: order.delivery_status }], rowCount: 1 }
      }
      throw new Error('Unhandled client query: ' + normalized)
    },
    release() {},
  }

  const pool = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\\s+/g, ' ').trim()
      queries.push({ sql: normalized, params })
      if (normalized.includes('shopify_webhook_secret') && normalized.includes('shopify_domain')) {
        return { rows: [{ id: MERCHANT_ID, shopify_webhook_secret: SECRET }] }
      }
      throw new Error('Unhandled pool query: ' + normalized)
    },
    async connect() { return client },
  }

  const app = express()
  app.post('/api/webhooks/shopify', express.raw({ type: 'application/json', limit: '1mb' }), (req, res, next) => {
    Promise.resolve(createShopifyWebhookHandler({ pool, onOrderPersist })(req, res)).catch(next)
  })
  app.use((error, _req, res, _next) => res.status(500).json({ status: 'error', message: 'Internal error' }))
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise(resolve => server.close(resolve)))
  await new Promise(resolve => server.once('listening', resolve))
  return { server, queries, state }
}

function sign(raw, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(Buffer.from(raw)).digest('base64')
}

async function postWebhook(server, raw, { secret = SECRET, domain = SHOP_DOMAIN, topic = 'orders/create', signature } = {}) {
  const headers = { 'content-type': 'application/json', 'x-shopify-hmac-sha256': signature || sign(raw, secret) }
  if (domain !== null) headers['x-shopify-shop-domain'] = domain
  if (topic !== null) headers['x-shopify-topic'] = topic
  return fetch(`http://127.0.0.1:${server.address().port}/api/webhooks/shopify`, {
    method: 'POST', headers, body: raw,
  })
}

const sampleOrder = {
  id: 987654321,
  name: '#1001',
  customer: { first_name: 'Ayesha', last_name: 'Rahman', phone: '+8801712345678' },
  total_price: '1499.50',
  currency: 'BDT',
  financial_status: 'pending',
  payment_gateway_names: ['Cash on Delivery'],
  line_items: [
    { id: 111, product_id: 222, variant_id: 333, title: 'Premium Cotton Shirt', sku: 'SHIRT-01', quantity: 2, price: '749.75', vendor: 'Kash Store' },
  ],
}

test('accepts Shopify HMAC and maps customer, total, financial status and line items', async t => {
  const reconciled = []
  const { server, state, queries } = await createTestServer(t, {
    onOrderPersist: async merchantId => reconciled.push(merchantId),
  })
  const raw = JSON.stringify(sampleOrder)
  const response = await postWebhook(server, raw)
  const body = await response.json()

  assert.equal(response.status, 202)
  assert.equal(body.status, 'success')
  assert.equal(body.quota_consumed, true)
  assert.equal(state.availableOrders, 9)
  assert.equal(state.orders.size, 1)
  const order = [...state.orders.values()][0]
  assert.equal(order.merchant_id, MERCHANT_ID)
  assert.equal(order.platform_order_id, '987654321')
  assert.equal(order.customer_phone, '01712345678')
  assert.equal(order.customer_name, 'Ayesha Rahman')
  assert.equal(order.total_amount, '1499.50')
  assert.equal(order.payment_status, 'unpaid')
  assert.equal(order.financial_status, 'pending')
  assert.equal(order.payment_method, 'Cash on Delivery')
  assert.equal(order.currency, 'BDT')
  assert.equal(order.line_items[0].sku, 'SHIRT-01')
  assert.deepEqual(reconciled, [MERCHANT_ID])
  assert.ok(queries.some(item => item.sql.startsWith('UPDATE public.merchants SET available_orders')))
})

test('uses exact raw bytes for Shopify HMAC validation', async t => {
  const { server, state } = await createTestServer(t)
  const raw = JSON.stringify(sampleOrder, null, 2) + '\n'
  const response = await postWebhook(server, raw)
  assert.equal(response.status, 202)
  assert.equal(state.orders.size, 1)
})

test('rejects an invalid HMAC before opening a transaction', async t => {
  const { server, state, queries } = await createTestServer(t)
  const response = await postWebhook(server, JSON.stringify(sampleOrder), { secret: 'wrong-secret' })
  assert.equal(response.status, 401)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.some(item => item.sql === 'BEGIN'), false)
})

test('rejects a missing or malformed Shopify shop-domain header', async t => {
  const { server, state, queries } = await createTestServer(t)
  const response = await postWebhook(server, JSON.stringify(sampleOrder), { domain: 'https://attacker.example/path' })
  assert.equal(response.status, 401)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.length, 0)
})

test('does not consume order quota twice for Shopify webhook retries', async t => {
  const { server, state } = await createTestServer(t)
  const raw = JSON.stringify(sampleOrder)
  const first = await postWebhook(server, raw)
  const retry = await postWebhook(server, JSON.stringify({ ...sampleOrder, total_price: '1599.00' }))
  assert.equal(first.status, 202)
  assert.equal(retry.status, 202)
  const retryBody = await retry.json()
  assert.equal(retryBody.quota_consumed, false)
  assert.equal(state.availableOrders, 9)
  assert.equal(state.orders.size, 1)
  assert.equal([...state.orders.values()][0].total_amount, '1599.00')
})

test('does not downgrade a previously paid order when a retry says pending', async t => {
  const { server, state } = await createTestServer(t)
  await postWebhook(server, JSON.stringify({ ...sampleOrder, financial_status: 'paid' }))
  await postWebhook(server, JSON.stringify({ ...sampleOrder, financial_status: 'pending' }))
  const order = [...state.orders.values()][0]
  assert.equal(order.payment_status, 'paid')
  assert.equal(order.financial_status, 'pending')
})

test('stores Shopify paid status as paid and does not mark it eligible for MFS matching', async t => {
  const { server, state } = await createTestServer(t)
  const response = await postWebhook(server, JSON.stringify({ ...sampleOrder, financial_status: 'paid' }))
  assert.equal(response.status, 202)
  assert.equal([...state.orders.values()][0].payment_status, 'paid')
})

test('rejects malformed or incomplete order payloads without consuming quota', async t => {
  const { server, state } = await createTestServer(t)
  const response = await postWebhook(server, JSON.stringify({ id: 55, total_price: '100.00', line_items: [] }))
  assert.equal(response.status, 400)
  assert.equal(state.availableOrders, 10)
  assert.equal(state.orders.size, 0)
})

test('returns 403 and rolls back when the merchant order quota is exhausted', async t => {
  const { server, state, queries } = await createTestServer(t, { initialQuota: 0 })
  const response = await postWebhook(server, JSON.stringify(sampleOrder))
  assert.equal(response.status, 403)
  assert.equal(state.availableOrders, 0)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.at(-1).sql, 'ROLLBACK')
})

test('rolls back quota if the order insert fails', async t => {
  const { server, state, queries } = await createTestServer(t, { failInsert: true })
  const response = await postWebhook(server, JSON.stringify(sampleOrder))
  assert.equal(response.status, 500)
  assert.equal(state.availableOrders, 10)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.at(-1).sql, 'ROLLBACK')
})

test('ignores a validly signed event that is not orders/create', async t => {
  const { server, state } = await createTestServer(t)
  const response = await postWebhook(server, JSON.stringify(sampleOrder), { topic: 'orders/updated' })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).reason, 'unsupported_topic')
  assert.equal(state.orders.size, 0)
})
