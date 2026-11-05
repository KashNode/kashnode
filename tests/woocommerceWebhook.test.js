import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import { createWooCommerceWebhookHandler } from '../server/routes/woocommerceWebhook.js'

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111'
const SECRET = 'merchant-webhook-secret-0123456789abcdef'

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
          customer_trx_id: params[7],
          line_items: JSON.parse(params[8]),
          is_phone_verified: false,
          ai_call_status: 'pending',
          payment_status: params[5],
          currency: params[9],
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
        order.line_items = JSON.parse(params[6])
        if (!['paid', 'manual_review'].includes(order.payment_status)) order.payment_status = params[7]
        order.currency = params[8] || order.currency
        return { rows: [{ id: order.id, payment_status: order.payment_status, delivery_status: order.delivery_status }], rowCount: 1 }
      }
      throw new Error('Unhandled client query: ' + normalized)
    },
    release() {},
  }

  const pool = {
    async query(sql, params = []) {
      queries.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params })
      if (String(sql).includes('SELECT id, webhook_secret') && String(sql).includes('WHERE id = $1')) {
        return { rows: [{ id: MERCHANT_ID, webhook_secret: SECRET }] }
      }
      if (String(sql).includes('SELECT id, webhook_secret') && String(sql).includes('WHERE webhook_secret = $1')) {
        return params[0] === SECRET ? { rows: [{ id: MERCHANT_ID, webhook_secret: SECRET }] } : { rows: [] }
      }
      throw new Error('Unhandled pool query: ' + sql)
    },
    async connect() { return client },
  }

  const app = express()
  app.use(express.json({ verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer) } }))
  app.post('/hook/:merchantId', createWooCommerceWebhookHandler({ pool, onOrderPersist }))
  app.post('/api/webhooks/woocommerce', createWooCommerceWebhookHandler({ pool, onOrderPersist }))
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
    line_items: [],
    is_phone_verified: false,
    ai_call_status: 'pending',
    payment_status: 'unpaid',
    currency: null,
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


async function postPluginOrder(server, order, { secret = SECRET, signatureSecret = secret, includeSecret = true } = {}) {
  const payload = JSON.stringify(order)
  const headers = {
    'content-type': 'application/json',
    'x-wc-webhook-signature': signedRequest(payload, signatureSecret),
  }
  if (includeSecret) headers['x-kashnode-webhook-secret'] = secret
  return fetch('http://127.0.0.1:' + server.address().port + '/api/webhooks/woocommerce', {
    method: 'POST',
    headers,
    body: payload,
  })
}

test('accepts the WordPress plugin secret header and signed order payload on the dedicated route', async t => {
  const reconciled = []
  const { server, queries, state } = await createTestServer(t, {
    onOrderPersist: async merchantId => reconciled.push(merchantId),
  })
  const response = await postPluginOrder(server, {
    id: 'wc-9001',
    customer_name: 'Nusrat Jahan',
    customer_phone: '+8801712345678',
    total_amount: '2150.00',
    payment_method: 'cod',
    payment_method_title: 'Cash on delivery',
    line_items: [
      { id: 31, product_id: 501, variation_id: 0, name: 'Cotton Panjabi', sku: 'PAN-01', quantity: 2, subtotal: '2200.00', total: '2150.00' },
    ],
  })
  const body = await response.json()

  assert.equal(response.status, 202)
  assert.equal(body.quota_consumed, true)
  assert.equal(state.availableOrders, 9)
  assert.equal(state.orders.size, 1)
  const saved = [...state.orders.values()][0]
  assert.equal(saved.merchant_id, MERCHANT_ID)
  assert.equal(saved.platform_order_id, 'wc-9001')
  assert.equal(saved.customer_phone, '01712345678')
  assert.equal(saved.customer_name, 'Nusrat Jahan')
  assert.equal(saved.total_amount, '2150.00')
  assert.equal(saved.payment_method, 'cod')
  assert.deepEqual(saved.line_items, [{
    id: '31',
    product_id: '501',
    variation_id: '0',
    name: 'Cotton Panjabi',
    sku: 'PAN-01',
    quantity: 2,
    subtotal: '2200.00',
    total: '2150.00',
  }])
  assert.equal(saved.is_phone_verified, false)
  assert.equal(saved.ai_call_status, 'pending')
  assert.deepEqual(reconciled, [MERCHANT_ID])
  const lookup = queries.find(item => item.sql.includes('WHERE webhook_secret = $1'))
  assert.deepEqual(lookup.params, [SECRET])
})

test('deduplicates retries on the dedicated WooCommerce endpoint without spending quota twice', async t => {
  const { server, state } = await createTestServer(t)
  const order = {
    id: 9002,
    customer_name: 'Repeat Customer',
    customer_phone: '01712345678',
    total_amount: '500.00',
    payment_method: 'bKash',
    line_items: [],
  }
  const first = await postPluginOrder(server, order)
  const retry = await postPluginOrder(server, { ...order, total_amount: '550.00' })
  assert.equal(first.status, 202)
  assert.equal(retry.status, 202)
  assert.equal((await retry.json()).quota_consumed, false)
  assert.equal(state.availableOrders, 9)
  assert.equal(state.orders.size, 1)
  assert.equal([...state.orders.values()][0].total_amount, '550.00')
})

test('rejects an unknown merchant secret before opening a transaction', async t => {
  const { server, state, queries } = await createTestServer(t)
  const response = await postPluginOrder(server, {
    id: 9003, customer_phone: '01712345678', total_amount: '500.00',
  }, { secret: 'x'.repeat(40) })
  assert.equal(response.status, 401)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.some(item => item.sql === 'BEGIN'), false)
})

test('rejects a bad HMAC even when the merchant secret header is valid', async t => {
  const { server, state, queries } = await createTestServer(t)
  const response = await postPluginOrder(server, {
    id: 9004, customer_phone: '01712345678', total_amount: '500.00',
  }, { signatureSecret: 'wrong-signing-secret' })
  assert.equal(response.status, 401)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.some(item => item.sql === 'BEGIN'), false)
})

test('rejects a signed request that omits the merchant secret header on the new endpoint', async t => {
  const { server, state, queries } = await createTestServer(t)
  const response = await postPluginOrder(server, {
    id: 9005, customer_phone: '01712345678', total_amount: '500.00',
  }, { includeSecret: false })
  assert.equal(response.status, 401)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.length, 0)
})


test('persists WooCommerce paid state and currency while preserving paid status on later retries', async t => {
  const { server, state } = await createTestServer(t)
  const firstPayload = {
    id: 'wc-paid-9100',
    customer_name: 'Paid Customer',
    customer_phone: '01712345678',
    total_amount: '1499.00',
    payment_method: 'bkash',
    payment_status: 'paid',
    currency: 'BDT',
    line_items: [],
  }

  const first = await postPluginOrder(server, firstPayload)
  assert.equal(first.status, 202)
  const order = [...state.orders.values()][0]
  assert.equal(order.payment_status, 'paid')
  assert.equal(order.currency, 'BDT')

  const retry = await postPluginOrder(server, { ...firstPayload, payment_status: 'unpaid' })
  assert.equal(retry.status, 202)
  assert.equal(order.payment_status, 'paid')
  assert.equal(order.currency, 'BDT')
})

test('defaults untrusted or unknown WooCommerce payment status to unpaid', async t => {
  const { server, state } = await createTestServer(t)
  const response = await postPluginOrder(server, {
    id: 'wc-pending-9101',
    customer_name: 'Pending Customer',
    customer_phone: '01712345678',
    total_amount: '700.00',
    payment_method: 'nagad',
    payment_status: 'settled-maybe',
    currency: 'BDT',
  })
  assert.equal(response.status, 202)
  assert.equal([...state.orders.values()][0].payment_status, 'unpaid')
})
