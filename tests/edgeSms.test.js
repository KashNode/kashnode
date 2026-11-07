import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import express from 'express'
import { parseMfsSms } from '../server/parsers/mfs.js'
import { createEdgeSmsHandler } from '../server/routes/edgeSms.js'

describe('MFS SMS parser', () => {
  it('parses bKash amount, transaction ID, provider and payer phone', () => {
    const parsed = parseMfsSms(
      'bKash',
      'You have received Tk 1,500.00 from 01712345678. Fee Tk 0.00. Balance Tk 45,200.00. TrxID 9J82KL091',
    )
    assert.deepEqual(parsed, {
      provider: 'bKash',
      amount: 1500,
      trxId: '9J82KL091',
      customerPhone: '01712345678',
    })
  })

  it('normalizes an international payer phone format', () => {
    const parsed = parseMfsSms('bKash', 'You have received Tk 25.00 from +880 1712-345678. TrxID BKS123')
    assert.equal(parsed.customerPhone, '01712345678')
  })

  it('parses Nagad amount labels and TxnID', () => {
    const parsed = parseMfsSms('NAGAD', 'Money received. Amount: Tk 2,010.50. From: 01812345678. TxnID: NGD123ABC')
    assert.equal(parsed.provider, 'Nagad')
    assert.equal(parsed.amount, 2010.5)
    assert.equal(parsed.customerPhone, '01812345678')
    assert.equal(parsed.trxId, 'NGD123ABC')
  })

  it('parses Rocket by sender label or DBBL short code, and parses Upay', () => {
    assert.equal(parseMfsSms('Rocket', 'Cash In received Tk 75.25 from 01912345678. TrxID RKT881').provider, 'Rocket')
    assert.equal(parseMfsSms('16216', 'Cash In received Tk 75.25. TrxID RKT882').provider, 'Rocket')
    assert.equal(parseMfsSms('Upay', 'Amount: Tk 1,005.00 TxnID: UPAY19').amount, 1005)
  })

  it('does not mistake fee, balance or unrelated numbers for the payer phone', () => {
    const parsed = parseMfsSms('bKash', 'You have received Tk 100.00. Fee Tk 0.00. Balance Tk 450.00. TrxID ABC123')
    assert.equal(parsed.customerPhone, null)
  })

  it('returns stable null fields for unknown or invalid messages', () => {
    assert.deepEqual(parseMfsSms('Unknown', 'Message has Tk 100 and TrxID ABC123'), {
      provider: null,
      amount: null,
      trxId: 'ABC123',
      customerPhone: null,
    })
    assert.deepEqual(parseMfsSms('bKash', null), {
      provider: null,
      amount: null,
      trxId: null,
      customerPhone: null,
    })
  })
})

describe('POST /api/v1/edge/sms handler', () => {
  const requests = []
  const reconciledSmsIds = []
  const query = async (sql, params) => {
    requests.push({ sql, params })
    if (sql.includes('SELECT id FROM merchants')) return { rows: [{ id: 'merchant-uuid' }] }
    if (sql.includes('SELECT pg_advisory_xact_lock')) return { rows: [] }
    if (sql.includes('SELECT id FROM public.raw_sms_inbox')) return { rows: [] }
    if (sql.includes('SELECT id FROM public.merchant_topups')) return { rows: [] }
    if (sql.includes('INSERT INTO public.raw_sms_inbox')) return { rows: [{ id: 'sms-uuid' }] }
    return { rows: [] }
  }
  const pool = { query, async connect() { return { query, release() {} } } }

  const app = express()
  app.use(express.json())
  app.use((req,_res,next)=>{if(req.get('authorization')==='Bearer native-token'){req.nativeUser={id:'user-uuid',merchantId:'merchant-uuid',role:'user'}};next()})
  app.post('/api/v1/edge/sms', createEdgeSmsHandler({
    pool,
    onPersist: async smsId => reconciledSmsIds.push(smsId),
  }))
  const server = app.listen(0, '127.0.0.1')
  const baseUrl = new Promise(resolve => server.once('listening', () => resolve('http://127.0.0.1:' + server.address().port)))
  after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())))

  it('authenticates, stores all parsed fields and starts reconciliation after persistence', async () => {
    requests.length = 0
    reconciledSmsIds.length = 0
    const response = await fetch((await baseUrl) + '/api/v1/edge/sms', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer native-token', 'x-merchant-id': 'merchant-uuid' },
      body: JSON.stringify({
        sender: 'bKash',
        message: 'You have received Tk 1,500.00 from 01712345678. TrxID 9J82KL091',
        sim_slot: 1,
        received_at: '2026-11-04T17:30:00Z',
      }),
    })

    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), {
      success: true,
      id: 'sms-uuid',
      parsed: { amount: 1500, trxId: '9J82KL091', provider: 'bKash', customerPhone: '01712345678' },
    })
    assert.equal(requests.length, 6)
    assert.match(requests[4].sql, /provider, customer_phone/)
    assert.deepEqual(requests[4].params, [
      'merchant-uuid',
      'bKash',
      'You have received Tk 1,500.00 from 01712345678. TrxID 9J82KL091',
      '9J82KL091',
      1500,
      'bKash',
      '01712345678',
      '2026-11-04T17:30:00.000Z',
    ])
    assert.deepEqual(reconciledSmsIds, ['sms-uuid'])
  })

  it('rejects requests without a merchant secret before querying the database', async () => {
    requests.length = 0
    const response = await fetch((await baseUrl) + '/api/v1/edge/sms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sender: 'bKash', message: 'received Tk 100 TrxID ABC123' }),
    })

    assert.equal(response.status, 401)
    assert.equal(requests.length, 0)
  })
})
