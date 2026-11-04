import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import express from 'express'
import { parseMfsSms } from '../server/parsers/mfs.js'
import { createEdgeSmsHandler } from '../server/routes/edgeSms.js'

describe('MFS SMS parser', () => {
  it('parses the bKash received amount and transaction ID without using fee or balance', () => {
    const parsed = parseMfsSms('bKash', 'You have received Tk 1,500.00 from 01712345678. Fee Tk 0.00. Balance Tk 45,200.00. TrxID 9J82KL091 at 04/11/2026 17:30')
    assert.equal(parsed.amount, 1500)\n    assert.equal(parsed.trxId, '9J82KL091')\n    assert.equal(parsed.provider, 'bKash')
  })

  it('parses Nagad amount labels and TxnID', () => {
    assert.equal(parseMfsSms('NAGAD', 'Money received. Amount: Tk 2,010.50. TxnID: NGD123ABC').amount, 2010.5)
  })

  it('parses Rocket receipt formats and transaction IDs', () => {
    assert.equal(parseMfsSms('Rocket', 'Cash In received Tk 75.25. TrxID RKT881').trxId, 'RKT881')
  })

  it('parses Upay amount and TxnID', () => {
    assert.equal(parseMfsSms('Upay', 'Amount: Tk 1,005.00 TxnID: UPAY19').amount, 1005)
  })

  it('returns null fields for unknown or unparseable messages', () => {
    assert.equal(parseMfsSms('Unknown', 'Message has Tk 100 and TrxID ABC123').amount, null)
    assert.equal(parseMfsSms('bKash', 'No transaction details').trxId, null)
  })
})

describe('POST /api/v1/edge/sms handler', () => {
  const requests = []
  const pool = {
    async query(sql, params) {
      requests.push({ sql, params })
      if (sql.includes('SELECT id FROM merchants')) return { rows: [{ id: 'merchant-uuid' }] }
      return { rows: [{ id: 'sms-uuid' }] }
    },
  }

  const app = express()
  app.use(express.json())
  app.post('/api/v1/edge/sms', createEdgeSmsHandler({ pool }))
  const server = app.listen(0, '127.0.0.1')
  const baseUrl = new Promise(resolve => server.once('listening', () => resolve(`http://127.0.0.1:${server.address().port}`)))
  after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())))

  it('authenticates the merchant and persists parsed SMS with its received timestamp', async () => {
    requests.length = 0
    const response = await fetch(`${await baseUrl}/api/v1/edge/sms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-merchant-secret': 'merchant-secret' },
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
      parsed: { amount: 1500, trxId: '9J82KL091' },
    })
    assert.equal(requests.length, 2)
    assert.equal(requests[0].params[0], 'merchant-secret')
    assert.equal(requests[1].params[0], 'merchant-uuid')
    assert.equal(requests[1].params[3], '9J82KL091')
    assert.equal(requests[1].params[4], 1500)
    assert.equal(requests[1].params[7], '2026-11-04T17:30:00.000Z')
  })

  it('rejects requests without a merchant secret before querying the database', async () => {
    requests.length = 0
    const response = await fetch(`${await baseUrl}/api/v1/edge/sms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sender: 'bKash', message: 'received Tk 100 TrxID ABC123' }),
    })

    assert.equal(response.status, 401)
    assert.equal(requests.length, 0)
  })
})
