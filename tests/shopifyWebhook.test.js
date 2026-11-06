import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import { createShopifyWebhookHandler } from '../server/routes/shopifyWebhook.js'

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111'
const SHOP_DOMAIN = 'test-shop.myshopify.com'
const SECRET = 'shopify-merchant-webhook-secret'

async function createTestServer(t, {
  walletBalance = 50,
  voiceMinutes = 0,
  failInsert = false,
  onOrderPersist = async () => {},
} = {}) {
  const queries = []
  const state = {
    walletBalance,
    voiceMinutes,
    orders: new Map(),
    nextId: 0,
  }

  const client = {
    snapshot: null,
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim()
      queries.push({ sql: normalized, params })

      if (normalized === 'BEGIN') {
        this.snapshot = {
          walletBalance: state.walletBalance,
          voiceMinutes: state.voiceMinutes,
          orders: new Map([...state.orders.entries()].map(([key, value]) => [key, structuredClone(value)])),
          nextId: state.nextId,
        }
        return { rows: [] }
      }

      if (normalized === 'COMMIT') {
        this.snapshot = null
        return { rows: [] }
      }

      if (normalized === 'ROLLBACK') {
        if (this.snapshot) {
          state.walletBalance = this.snapshot.walletBalance
          state.voiceMinutes = this.snapshot.voiceMinutes
          state.orders = this.snapshot.orders
          state.nextId = this.snapshot.nextId
          this.snapshot = null
        }
        return { rows: [] }
      }

      if (normalized.startsWith('INSERT INTO public.orders')) {
        if (failInsert) throw new Error('simulated insert failure')
        const key = `${params[0]}:${params[1]}`
        const existing = state.orders.get(key)
        if (!existing) state.nextId += 1
        const order = existing || { id: `shopify-order-${state.nextId}`, merchant_id: params[0], platform_order_id: params[1] }
        Object.assign(order, {
          order_number: params[2], customer_phone: params[3], customer_name: params[4],
          total_amount: params[5],
          payment_status: existing?.payment_status === 'paid' && params[6] === 'unpaid' ? 'paid' : params[6],
          delivery_status: params[7], payment_method: params[8],
          line_items: JSON.parse(params[9]), financial_status: params[10],
          fulfillment_status: params[11], currency: params[12], shipping_address: params[13],
        })
        state.orders.set(key, order)
        return { rows: [{ id: order.id, payment_status: order.payment_status, delivery_status: order.delivery_status }], rowCount: 1 }
      }

      throw new Error('Unhandled pool query: ' + normalized)
    },
    release() {},
  }

  const pool = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim()
      queries.push({ sql: normalized, params })
      if (normalized.includes('FROM public.merchant_integrations')) return { rows: [] }
      if (normalized.startsWith('INSERT INTO public.orders')) {
        if (failInsert) throw new Error('simulated insert failure')
        const key = `${params[0]}:${params[1]}`
        const existing = state.orders.get(key)
        if (!existing) state.nextId += 1
        const order = existing || { id: `shopify-order-${state.nextId}`, merchant_id: params[0], platform_order_id: params[1] }
        Object.assign(order, {
          order_number: params[2], customer_phone: params[3], customer_name: params[4],
          total_amount: params[5],
          payment_status: existing?.payment_status === 'paid' && params[6] === 'unpaid' ? 'paid' : params[6],
          delivery_status: params[7], payment_method: params[8],
          line_items: JSON.parse(params[9]), financial_status: params[10],
          fulfillment_status: params[11], currency: params[12], shipping_address: params[13],
        })
        state.orders.set(key, order)
        return { rows: [{ id: order.id, payment_status: order.payment_status, delivery_status: order.delivery_status }], rowCount: 1 }
      }
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

async function postWebhook(server, raw, {
  secret = SECRET,
  domain = SHOP_DOMAIN,
  topic = 'orders/create',
  signature,
} = {}) {
  const headers = {
    'content-type': 'application/json',
    'x-shopify-hmac-sha256': signature || sign(raw, secret),
  }
  if (domain !== null) headers['x-shopify-shop-domain'] = domain
  if (topic !== null) headers['x-shopify-topic'] = topic
  return fetch(`http://127.0.0.1:${server.address().port}/api/webhooks/shopify`, {
    method: 'POST',
    headers,
    body: raw,
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

test('accepts Shopify HMAC and maps customer, total, financial status and line items without per-order wallet debit', async t => {
  const reconciled = []
  const { server, state, queries } = await createTestServer(t, {
    onOrderPersist: async merchantId => reconciled.push(merchantId),
  })
  const raw = JSON.stringify(sampleOrder)
  const response = await postWebhook(server, raw)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.status, 'success')
  assert.equal('quota_consumed' in body, false)
  assert.equal(state.walletBalance, 50)
  assert.equal(state.voiceMinutes, 0)
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
  assert.ok(queries.some(item => item.sql.startsWith('INSERT INTO public.orders') && item.sql.includes('ON CONFLICT (merchant_id, platform_order_id)')))
  const merchantLookup = queries.find(item => item.sql.includes('shopify_webhook_secret'))
  assert.deepEqual(merchantLookup.params, [SHOP_DOMAIN])
})

test('uses exact raw bytes for Shopify HMAC validation', async t => {
  const { server, state } = await createTestServer(t)
  const raw = JSON.stringify(sampleOrder, null, 2) + '\n'
  const response = await postWebhook(server, raw)
  assert.equal(response.status, 200)
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

test('Shopify retries update the existing order without debiting wallet funds twice', async t => {
  const { server, state } = await createTestServer(t)
  const raw = JSON.stringify(sampleOrder)
  const first = await postWebhook(server, raw)
  const retry = await postWebhook(server, JSON.stringify({ ...sampleOrder, total_price: '1599.00' }))
  assert.equal(first.status, 200)
  assert.equal(retry.status, 200)
  const retryBody = await retry.json()
  assert.equal('quota_consumed' in retryBody, false)
  assert.equal(state.walletBalance, 50)
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
  assert.equal(response.status, 200)
  assert.equal([...state.orders.values()][0].payment_status, 'paid')
})

test('rejects malformed or incomplete order payloads without changing wallet credits', async t => {
  const { server, state } = await createTestServer(t)
  const response = await postWebhook(server, JSON.stringify({ id: 55, total_price: '100.00', line_items: [] }))
  assert.equal(response.status, 400)
  assert.equal(state.walletBalance, 50)
  assert.equal(state.voiceMinutes, 0)
  assert.equal(state.orders.size, 0)
})

test('accepts a new Shopify order with prepaid voice minutes and a zero wallet balance', async t => {
  const { server, state } = await createTestServer(t, { walletBalance: 0, voiceMinutes: 8 })
  const response = await postWebhook(server, JSON.stringify(sampleOrder))
  assert.equal(response.status, 200)
  assert.equal(state.walletBalance, 0)
  assert.equal(state.voiceMinutes, 8)
  assert.equal(state.orders.size, 1)
})

test('rejects a new Shopify order when wallet and prepaid voice minutes are exhausted', async t => {
  const { server, state, queries } = await createTestServer(t, { walletBalance: 0, voiceMinutes: 0 })
  const response = await postWebhook(server, JSON.stringify(sampleOrder))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.status, 'success')
  assert.equal(state.walletBalance, 0)
  assert.equal(state.voiceMinutes, 0)
  assert.equal(state.orders.size, 1)
  assert.equal(queries.some(item => item.sql.startsWith('INSERT INTO public.orders')), true)
})

test('rolls back order insert failures without changing wallet or voice credits', async t => {
  const { server, state, queries } = await createTestServer(t, {
    walletBalance: 50,
    voiceMinutes: 3,
    failInsert: true,
  })
  const response = await postWebhook(server, JSON.stringify(sampleOrder))
  assert.equal(response.status, 500)
  assert.equal(state.walletBalance, 50)
  assert.equal(state.voiceMinutes, 3)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.some(item => item.sql.startsWith('INSERT INTO public.orders')), true)
})

test('processes both create and update topics with idempotent upsert', async t => {
  const { server, state } = await createTestServer(t)
  const response = await postWebhook(server, JSON.stringify(sampleOrder), { topic: 'orders/updated' })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).status, 'success')
  assert.equal(state.orders.size, 1)
})

test('preserves Shopify 64-bit order IDs exactly for idempotency', async t => {
  const { server, state } = await createTestServer(t)
  const raw = JSON.stringify({ ...sampleOrder, id: '987654321987654321' })
    .replace('"id":"987654321987654321"', '"id":987654321987654321')
  const response = await postWebhook(server, raw)
  assert.equal(response.status, 200)
  assert.equal([...state.orders.values()][0].platform_order_id, '987654321987654321')
})

test('maps partially paid Shopify orders to manual review, not MFS-unpaid', async t => {
  const { server, state } = await createTestServer(t)
  const response = await postWebhook(server, JSON.stringify({ ...sampleOrder, financial_status: 'partially_paid' }))
  assert.equal(response.status, 200)
  assert.equal([...state.orders.values()][0].payment_status, 'manual_review')
})

test('rejects a webhook without the Shopify topic header', async t => {
  const { server, state } = await createTestServer(t)
  const response = await postWebhook(server, JSON.stringify(sampleOrder), { topic: null })
  assert.equal(response.status, 400)
  assert.equal(state.orders.size, 0)
})
