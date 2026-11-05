import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import { createWooCommerceWebhookHandler } from '../server/routes/woocommerceWebhook.js'

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111'
const SECRET = 'merchant-webhook-secret-0123456789abcdef'

async function createTestServer(t, { walletBalance = 20, voiceMinutes = 0, failInsert = false } = {}) {
  const queries = []
  const state = { walletBalance, voiceMinutes, orders: new Map(), nextId: 0 }
  const client = {
    snapshot: null,
    async query(sql, params = []) {
      const q = String(sql).replace(/\s+/g, ' ').trim()
      queries.push(q)
      if (q === 'BEGIN') {
        this.snapshot = { walletBalance: state.walletBalance, voiceMinutes: state.voiceMinutes, orders: new Map(state.orders), nextId: state.nextId }
        return { rows: [] }
      }
      if (q === 'COMMIT') { this.snapshot = null; return { rows: [] } }
      if (q === 'ROLLBACK') {
        if (this.snapshot) {
          state.walletBalance = this.snapshot.walletBalance
          state.voiceMinutes = this.snapshot.voiceMinutes
          state.orders = this.snapshot.orders
          state.nextId = this.snapshot.nextId
          this.snapshot = null
        }
        return { rows: [] }
      }
      if (q.startsWith('SELECT id, wallet_balance, available_voice_minutes FROM public.merchants')) {
        return { rows: [{ id: MERCHANT_ID, wallet_balance: state.walletBalance, available_voice_minutes: state.voiceMinutes }] }
      }
      if (q.startsWith('SELECT id, payment_status, delivery_status FROM public.orders')) {
        const row = state.orders.get(`${params[0]}:${params[1]}`)
        return { rows: row ? [{ id: row.id, payment_status: row.payment_status, delivery_status: row.delivery_status }] : [] }
      }
      if (q.startsWith('INSERT INTO public.orders')) {
        if (failInsert) throw new Error('simulated insert failure')
        const key = `${params[0]}:${params[1]}`
        state.nextId += 1
        const row = {
          id: `order-${state.nextId}`,
          merchant_id: params[0],
          platform_order_id: params[1],
          customer_phone: params[2],
          customer_name: params[3],
          total_amount: params[4],
          payment_status: params[5],
          payment_method: params[6],
          customer_trx_id: params[7],
          line_items: JSON.parse(params[8]),
          currency: params[9],
          delivery_status: 'pending',
        }
        state.orders.set(key, row)
        return { rows: [{ id: row.id, payment_status: row.payment_status, delivery_status: row.delivery_status }] }
      }
      if (q.startsWith('UPDATE public.orders SET customer_phone')) {
        const row = [...state.orders.values()].find(item => item.id === params[0])
        if (!row) return { rows: [], rowCount: 0 }
        row.customer_phone = params[1]
        row.customer_name = params[2]
        row.total_amount = params[3]
        row.payment_method = params[4]
        row.customer_trx_id = params[5]
        row.line_items = JSON.parse(params[6])
        if (!['paid', 'manual_review'].includes(row.payment_status)) row.payment_status = params[7]
        row.currency = params[8] || row.currency
        return { rows: [{ id: row.id, payment_status: row.payment_status, delivery_status: row.delivery_status }], rowCount: 1 }
      }
      throw new Error('Unhandled client query: ' + q)
    },
    release() {},
  }
  const pool = {
    async query(sql, params = []) {
      const q = String(sql).replace(/\s+/g, ' ').trim()
      queries.push(q)
      if (q.includes('SELECT id, webhook_secret') && q.includes('WHERE webhook_secret = $1')) {
        return params[0] === SECRET ? { rows: [{ id: MERCHANT_ID, webhook_secret: SECRET }] } : { rows: [] }
      }
      if (q.includes('SELECT id, webhook_secret') && q.includes('WHERE id = $1')) {
        return { rows: [{ id: MERCHANT_ID, webhook_secret: SECRET }] }
      }
      throw new Error('Unhandled pool query: ' + q)
    },
    async connect() { return client },
  }
  const app = express()
  app.use(express.json({ verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer) } }))
  app.post('/hook/:merchantId', createWooCommerceWebhookHandler({ pool }))
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise(resolve => server.close(resolve)))
  await new Promise(resolve => server.once('listening', resolve))
  return { server, state, queries }
}

function sign(payload, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(Buffer.from(payload)).digest('base64')
}

async function post(server, order, secret = SECRET) {
  const body = JSON.stringify(order)
  return fetch(`http://127.0.0.1:${server.address().port}/hook/${MERCHANT_ID}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-wc-webhook-signature': sign(body, secret) },
    body,
  })
}

test('accepts a new order with positive wallet balance and leaves funds untouched', async t => {
  const { server, state, queries } = await createTestServer(t, { walletBalance: 50 })
  const response = await post(server, { id: 7001, billing: { phone: '01712345678' }, total: '1250.00', payment_method: 'bKash' })
  const body = await response.json()
  assert.equal(response.status, 202)
  assert.equal(body.order_id, 'order-1')
  assert.equal(state.walletBalance, 50)
  assert.equal(state.orders.size, 1)
  assert.ok(queries.some(q => q.startsWith('SELECT id, wallet_balance, available_voice_minutes')))
})

test('accepts a new order with prepaid voice minutes and zero wallet balance', async t => {
  const { server, state } = await createTestServer(t, { walletBalance: 0, voiceMinutes: 6 })
  const response = await post(server, { id: 7002, billing: { phone: '01712345678' }, total: '500', payment_method: 'cod' })
  assert.equal(response.status, 202)
  assert.equal(state.walletBalance, 0)
  assert.equal(state.voiceMinutes, 6)
  assert.equal(state.orders.size, 1)
})

test('rejects a new order when wallet and prepaid voice minutes are exhausted', async t => {
  const { server, state, queries } = await createTestServer(t, { walletBalance: 0, voiceMinutes: 0 })
  const response = await post(server, { id: 7003, billing: { phone: '01712345678' }, total: '500', payment_method: 'cod' })
  const body = await response.json()
  assert.equal(response.status, 402)
  assert.equal(body.code, 'INSUFFICIENT_VOICE_CREDIT')
  assert.equal(state.orders.size, 0)
  assert.equal(queries.some(q => q.startsWith('INSERT INTO public.orders')), false)
  assert.equal(queries.at(-1), 'ROLLBACK')
})

test('webhook retries update the existing order without a second wallet debit', async t => {
  const { server, state } = await createTestServer(t, { walletBalance: 50 })
  const payload = { id: 7004, billing: { phone: '01712345678' }, total: '500', payment_method: 'cod' }
  const first = await post(server, payload)
  const retry = await post(server, { ...payload, total: '550' })
  assert.equal(first.status, 202)
  assert.equal(retry.status, 202)
  assert.equal(state.walletBalance, 50)
  assert.equal(state.orders.size, 1)
  assert.equal([...state.orders.values()][0].total_amount, '550.00')
})

test('rolls back a failed order insert without changing merchant credits', async t => {
  const { server, state, queries } = await createTestServer(t, { walletBalance: 20, voiceMinutes: 3, failInsert: true })
  const response = await post(server, { id: 7005, billing: { phone: '01712345678' }, total: '500', payment_method: 'bKash' })
  assert.equal(response.status, 500)
  assert.equal(state.walletBalance, 20)
  assert.equal(state.voiceMinutes, 3)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.at(-1), 'ROLLBACK')
})

test('rejects an invalid webhook signature before opening a transaction', async t => {
  const { server, state, queries } = await createTestServer(t)
  const response = await post(server, { id: 7006, billing: { phone: '01712345678' }, total: '500' }, 'incorrect-secret')
  assert.equal(response.status, 401)
  assert.equal(state.orders.size, 0)
  assert.equal(queries.includes('BEGIN'), false)
})
