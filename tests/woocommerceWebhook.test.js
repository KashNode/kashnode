import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import { createWooCommerceWebhookHandler } from '../server/routes/woocommerceWebhook.js'

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111'
const SECRET = 'merchant-webhook-secret'

async function createTestServer(t, { onOrderPersist = async () => {}, initialQuota = 10, failInsert = false } = {}) {
  const queries = []
  const state = {
    availableOrders: initialQuota,
    orders: new Map(),
    nextOrderId: 0,
  }

  const client = {
    snapshot: null,
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim()
      queries.push({ sql: normalized, params })
      if (normalized === 'BEGIN') {
        this.snapshot = {
          availableOrders: state.availableOrders,
          orders: new Map([...state.orders.entries()].map(([key, value]) => [key, { ...value }])),
          nextOrderId: state.nextOrderId,
        }
        return { rows: [] }
      }
      if (normalized === 'COMMIT') {
        this.snapshot = null
        return { rows: [] }
      }
      if (normalized === 'ROLLBACK') {
        if (this.snapshot) {
          state.availableOrders = this.snapshot.availableOrders
          state.orders = this.snapshot.orders
          state.nextOrderId = this.snapshot.nextOrderId
          this.snapshot = null
        }
        return { rows: [] }
      }
      if (normalized.startsWith('SELECT id FROM public.merchants')) {
        return { rows: [{ id: MERCHANT_ID }] }
      }
      if (normalized.includes('FROM public.orders') && normalized.startsWith('SELECT id,')) {
        const order = state.orders.get(`${params[0]}:${params[1]}`)
        return { rows: order ? [{ id: order.id, payment_status: order.payment_status, delivery_status: order.delivery_status }] : [] }
      }
      if (normalized.startsWith('UPDATE public.merchants SET available_orders')) {
        if (state.availableOrders <= 0) return { rows: [], rowCount: 0 }
        state.availableOrders -= 1
        return { rows: [{ available_orders: state.availableOrders }], rowCount: 1 }
      }
      if (normalized.startsWith('INSERT INTO public.orders')) {
        if (failInsert) throw new Error('simulated order insert failure')
        const key = `${params[0]}:${params[1]}`
        if (state.orders.has(key)) throw new Error('duplicate order')
        state.nextOrderId += 1
        const order = {
          id: `order-${state.nextOrderId}`,
          merchant_id: params[0],
          platform_order_id: params[1],
          customer_phone: params[2],
          customer_name: params[3],
          total_amount: params[4],
          payment_method: params[5],
          customer_trx_id: params[6],
          payment_status: 'unpaid',
          delivery_status: 'pending',
        }
        state.orders.set(key, order)
        return { rows: [{ id: order.id, payment_status: order.payment_status, delivery_status: order.delivery_status }], rowCount: 1 }
      }
      if (normalized.startsWith('UPDATE public.orders SET customer_phone')) {
        const order = [...state.orders.values()].find(value => value.id === params[0])
        if (!order) return { rows: [], rowCount: 0 }
        order.customer_phone = params[1]
        order.customer_name = params[2]
        order.total_amount = params[3]
        order.payment_method = params[4]
        order.customer_trx_id = params[5]
        return { rows: [{ id: order.id, payment_status: order.payment_status, delivery_status: order.delivery_status }], rowCount: 1 }
      }
      throw new Error('Unhandled client query: ' + normalized)
    },
    release() {},
  }

  const pool = {
    async query(sql, params = []) {
      queries.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params })
      if (String(sql).includes('SELECT webhook_secret')) return { rows: [{ webhook_secret: SECRET }] }
      throw new Error('Unhandled pool query: ' + sql)
    },
    async connect() { return client },
  }

  const app = express()
  app.use(express.json({ verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer) } }))
  app.post('/hook/:merchantId', createWooCommerceWebhookHandler({ pool, onOrderPersist }))
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise(resolve => server.close(resolve)))
  await new Promise(resolve => server.once('listening', resolve))
  return { server, queries, state }
}

function signedRequest(payload, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(Buffer.from(payload)).digest('base64')
}

async function postOrder(server, order, secret = SECRET) {
  const payload = JSON.stringify(order)
  return fetch('http://127.0.0.1:' + server.address().port + '/hook/' + MERCHANT_ID, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-wc-webhook-signature': signedRequest(payload, secret),
    },
    body: payload,
  })
}

test('accepts signed WooCommerce payload, persists it and consumes one quota atomically', async t => {
  const reconciledMerchants = []
  const { server, queries, state } = await createTestServer(t, {
    onOrderPersist: async merchantId => reconciledMerchants.push(merchantId),
  })
  const response = await postOrder(server, {
    id: 1234,
    billing: { phone: '+880 1712-345678', first_name: 'Test', last_name: 'Customer' },
    total: '1050.00',
    shipping_total: '50.00',
    payment_method: 'bKash',
  })

  assert.equal(response.status, 202)
  const responseBody = await response.json()
  assert.equal(responseBody.order_id, 'order-1')
  assert.equal(responseBody.payment_status, 'unpaid')
  assert.equal(responseBody.quota_consumed, true)
  assert.equal(state.availableOrders, 9)
  assert.equal(state.orders.size, 1)

  const decrementIndex = queries.findIndex(item => item.sql.startsWith('UPDATE public.merchants SET available_orders'))
  const insertIndex = queries.findIndex(item => item.sql.startsWith('INSERT INTO public.orders'))
  const commitIndex = queries.findIndex(item => item.sql === 'COMMIT')
  assert.ok(decrementIndex > 0)
  assert.ok(insertIndex > decrementIndex)
  assert.ok(commitIndex > insertIndex)
  assert.match(queries[decrementIndex].sql, /available_orders > 0/)
  assert.deepEqual([...state.orders.values()][0], {
    id: 'order-1',
    merchant_id: MERCHANT_ID,
    platform_order_id: '1234',
    customer_phone: '01712345678',
    customer_name: 'Test Customer',
    total_amount: '1050.00',
    payment_method: 'bKash',
    customer_trx_id: null,
    payment_status: 'unpaid',
    delivery_status: 'pending',
  })
  assert.deepEqual(reconciledMerchants, [MERCHANT_ID])
})

test('does not consume quota twice when WooCommerce retries the same order webhook', async t => {
  const { server, state, queries } = await createTestServer(t)
  const payload = {
    id: 1237,
    billing: { phone: '01712345678', first_name: 'First' },
    total: '700.00',
    payment_method: 'bKash',
  }

  const first = await postOrder(server, payload)
  const firstBody = await first.json()
  const second = await postOrder(server, { ...payload, total: '725.00', billing: { phone: '01712345678', first_name: 'Updated' } })
  const secondBody = await second.json()

  assert.equal(first.status, 202)
  assert.equal(firstBody.quota_consumed, true)
  assert.equal(second.status, 202)
  assert.equal(secondBody.quota_consumed, false)
  assert.equal(state.availableOrders, 9)
  assert.equal(state.orders.size, 1)
  assert.equal([...state.orders.values()][0].total_amount, '725.00')
  assert.equal(queries.filter(item => item.sql.startsWith('UPDATE public.merchants SET available_orders')).length, 1)
})

test('returns 403 and does not create an order when the merchant quota is exhausted', async t => {
  const { server, state, queries } = await createTestServer(t, { initialQuota: 0 })
  const response = await postOrder(server, {
    id: 1238,
    billing: { phone: '01712345678' },
    total: '500.00',
    payment_method: 'bKash',
  })
  const body = await response.json()

  assert.equal(response.status, 403)
  assert.equal(body.code, 'LIMIT_EXCEEDED')
  assert.equal(body.limit, 'available_orders')
  assert.equal(state.availableOrders, 0)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.some(item => item.sql.startsWith('INSERT INTO public.orders')), false)
  assert.equal(queries.at(-1).sql, 'ROLLBACK')
})

test('restores quota if the order insert fails inside the transaction', async t => {
  const { server, state, queries } = await createTestServer(t, { initialQuota: 2, failInsert: true })
  const response = await postOrder(server, {
    id: 1239,
    billing: { phone: '01712345678' },
    total: '500.00',
    payment_method: 'bKash',
  })

  assert.equal(response.status, 500)
  assert.equal(state.availableOrders, 2)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.at(-1).sql, 'ROLLBACK')
})

test('stores COD marker and consumes one order quota unit', async t => {
  const { server, state } = await createTestServer(t)
  const response = await postOrder(server, {
    id: 1235,
    billing: { phone: '01712345678' },
    total: '500',
    payment_method: 'cod',
    payment_method_title: 'Cash on Delivery',
  })

  assert.equal(response.status, 202)
  assert.equal(state.availableOrders, 9)
  assert.equal([...state.orders.values()][0].payment_method, 'cod')
})

test('rejects an invalid WooCommerce signature without opening a transaction or inserting an order', async t => {
  const { server, queries, state } = await createTestServer(t)
  const response = await postOrder(server, {
    id: 1236,
    billing: { phone: '01712345678' },
    total: '500',
  }, 'wrong-secret')

  assert.equal(response.status, 401)
  assert.equal(queries.length, 1)
  assert.equal(state.availableOrders, 10)
  assert.equal(state.orders.size, 0)
})
