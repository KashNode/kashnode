import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeBdPhone,
  normalizeGateway,
  reconcilePendingSmsForMerchant,
  reconcileSms,
} from '../server/services/reconcileService.js'

function createMockPool({ sms, orders = [], duplicateTransaction = false } = {}) {
  const state = {
    sms: { id: 'sms-1', merchant_id: 'merchant-1', provider: 'bKash', customer_phone: '01712345678', parsed_trxid: 'BKS123', parsed_amount: '100.00', is_reconciled: false, ...sms },
    orders: orders.map(order => ({ payment_status: 'unpaid', payment_method: 'bKash', total_amount: '100.00', customer_phone: '01712345678', customer_trx_id: null, ...order })),
    transactions: duplicateTransaction ? [{ merchant_id: 'merchant-1', gateway: 'bKash', trx_id: 'BKS123' }] : [],
    statements: [],
    released: false,
  }

  const client = {
    async query(sql, params = []) {
      const normalized = String(sql).trim()
      state.statements.push({ sql: normalized, params })
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
        return { rows: [], rowCount: 0 }
      }
      if (normalized.includes('FROM raw_sms_inbox WHERE id = $1 FOR UPDATE')) {
        return { rows: state.sms && state.sms.id === params[0] ? [state.sms] : [], rowCount: state.sms ? 1 : 0 }
      }
      if (normalized.startsWith('SELECT o.id, o.customer_phone, o.customer_trx_id')) {
        const [merchantId, amount, phone, trxId] = params
        const rows = state.orders.filter(order => {
          if (order.merchant_id && order.merchant_id !== merchantId) return false
          if (order.payment_status !== 'unpaid') return false
          if (Number(order.total_amount).toFixed(2) !== amount) return false
          const method = String(order.payment_method || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')
          if (method === 'cod' || method === 'cash_on_delivery' || method.includes('cash_on_delivery')) return false
          const orderPhone = normalizeBdPhone(order.customer_phone)
          const trxMatch = trxId && String(order.customer_trx_id || '').trim().toUpperCase() === trxId
          const phoneMatch = phone && orderPhone === phone
          return Boolean(trxMatch || phoneMatch)
        })
        return { rows, rowCount: rows.length }
      }
      if (normalized.startsWith('INSERT INTO transactions')) {
        if (duplicateTransaction || state.transactions.some(tx => tx.merchant_id === params[0] && tx.gateway === params[1] && tx.trx_id === params[2])) {
          return { rows: [], rowCount: 0 }
        }
        state.transactions.push({ merchant_id: params[0], gateway: params[1], trx_id: params[2], amount: params[4], reference_user_id: params[5] })
        return { rows: [{ id: 'tx-1' }], rowCount: 1 }
      }
      if (normalized.startsWith("UPDATE orders SET payment_status = 'manual_review'")) {
        const ids = params[0]
        for (const order of state.orders) if (ids.includes(order.id) && order.payment_status === 'unpaid') order.payment_status = 'manual_review'
        return { rows: [], rowCount: ids.length }
      }
      if (normalized.startsWith("UPDATE orders SET payment_status = 'paid'")) {
        const order = state.orders.find(item => item.id === params[0] && item.payment_status === 'unpaid')
        if (!order) return { rows: [], rowCount: 0 }
        order.payment_status = 'paid'
        return { rows: [{ id: order.id }], rowCount: 1 }
      }
      if (normalized.startsWith('UPDATE raw_sms_inbox SET is_reconciled = TRUE')) {
        state.sms.is_reconciled = true
        return { rows: [], rowCount: 1 }
      }
      throw new Error('Unhandled mock SQL: ' + normalized)
    },
    release() { state.released = true },
  }

  const pool = {
    async connect() { return client },
    async query(sql, params) {
      state.statements.push({ sql: String(sql).trim(), params })
      if (String(sql).includes('SELECT id FROM raw_sms_inbox')) {
        return { rows: state.sms?.merchant_id === params[0] && !state.sms.is_reconciled ? [{ id: state.sms.id }] : [], rowCount: 1 }
      }
      throw new Error('Unhandled pool SQL: ' + sql)
    },
  }

  return { pool, state }
}

test('normalizes Bangladesh phones to the final 11 digits', () => {
  assert.equal(normalizeBdPhone('+880 1712-345678'), '01712345678')
  assert.equal(normalizeBdPhone('8801712345678'), '01712345678')
  assert.equal(normalizeBdPhone('01712 345 678'), '01712345678')
  assert.equal(normalizeBdPhone('12345'), null)
  assert.equal(normalizeBdPhone('01212345678'), null)
})

test('normalizes supported MFS gateway names', () => {
  assert.equal(normalizeGateway('bKash'), 'bKash')
  assert.equal(normalizeGateway('NAGAD'), 'Nagad')
  assert.equal(normalizeGateway('Rocket'), 'Rocket')
  assert.equal(normalizeGateway('Upay'), 'Upay')
  assert.equal(normalizeGateway('unknown'), null)
})

test('matches exact amount and normalized payer phone, then atomically marks order paid', async () => {
  const { pool, state } = createMockPool({
    orders: [{ id: 'order-1', customer_phone: '+880 1712-345678', total_amount: '100.00' }],
  })

  const result = await reconcileSms({ pool, smsId: 'sms-1' })

  assert.deepEqual(result, { outcome: 'matched', orderId: 'order-1' })
  assert.equal(state.orders[0].payment_status, 'paid')
  assert.equal(state.transactions.length, 1)
  assert.equal(state.sms.is_reconciled, true)
  assert.ok(state.statements.some(entry => entry.sql === 'BEGIN'))
  assert.ok(state.statements.some(entry => entry.sql === 'COMMIT'))
  assert.equal(state.released, true)
})

test('matches a supplied customer TrxID even when payer phone was not extracted', async () => {
  const { pool } = createMockPool({
    sms: { customer_phone: null },
    orders: [{ id: 'order-trx', customer_phone: '01999999999', customer_trx_id: 'bks123' }],
  })

  const result = await reconcileSms({ pool, smsId: 'sms-1' })
  assert.deepEqual(result, { outcome: 'matched', orderId: 'order-trx' })
})

test('does not auto-pay multiple matching orders and marks each manual_review', async () => {
  const { pool, state } = createMockPool({
    orders: [
      { id: 'order-1' },
      { id: 'order-2', customer_phone: '+8801712345678' },
    ],
  })

  const result = await reconcileSms({ pool, smsId: 'sms-1' })

  assert.deepEqual(result, { outcome: 'manual_review', orderIds: ['order-1', 'order-2'] })
  assert.deepEqual(state.orders.map(order => order.payment_status), ['manual_review', 'manual_review'])
  assert.equal(state.transactions.length, 0)
  assert.equal(state.sms.is_reconciled, false)
})

test('excludes COD orders from matching', async () => {
  const { pool, state } = createMockPool({
    orders: [{ id: 'cod-order', payment_method: 'cod' }],
  })

  const result = await reconcileSms({ pool, smsId: 'sms-1' })
  assert.deepEqual(result, { outcome: 'unmatched' })
  assert.equal(state.orders[0].payment_status, 'unpaid')
  assert.equal(state.transactions.length, 0)
})

test('does not apply a duplicate merchant/gateway transaction twice', async () => {
  const { pool, state } = createMockPool({
    orders: [{ id: 'order-1' }],
    duplicateTransaction: true,
  })

  const result = await reconcileSms({ pool, smsId: 'sms-1' })
  assert.deepEqual(result, { outcome: 'duplicate_transaction' })
  assert.equal(state.orders[0].payment_status, 'unpaid')
  assert.equal(state.sms.is_reconciled, true)
})

test('leaves unmatched SMS retryable for the later WooCommerce order event', async () => {
  const { pool, state } = createMockPool({ orders: [] })
  const result = await reconcileSms({ pool, smsId: 'sms-1' })
  assert.deepEqual(result, { outcome: 'unmatched' })
  assert.equal(state.sms.is_reconciled, false)

  state.orders.push({
    id: 'order-late',
    merchant_id: 'merchant-1',
    payment_status: 'unpaid',
    payment_method: 'bKash',
    total_amount: '100.00',
    customer_phone: '01712345678',
    customer_trx_id: null,
  })
  const retried = await reconcilePendingSmsForMerchant({ pool, merchantId: 'merchant-1' })
  assert.deepEqual(retried, [{ smsId: 'sms-1', outcome: 'matched', orderId: 'order-late' }])
  assert.equal(state.orders[0].payment_status, 'paid')
})
