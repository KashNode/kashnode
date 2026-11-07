import test from 'node:test'
import assert from 'node:assert/strict'
import { createEdgeCallHandlers } from '../server/routes/edgeCalls.js'

function response() {
  return {
    statusCode: 200,
    body: undefined,
    ended: false,
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
    end() { this.ended = true; return this },
  }
}

function request() {
  return { nativeUser: { id: 'user-1', merchantId: 'merchant-1', role: 'merchant' }, params: {}, body: {} }
}

test('pending call queue returns 204 when there are no eligible orders', async () => {
  const queries = []
  const client = {
    async query(sql) {
      queries.push(sql)
      if (sql.includes('SELECT o.id AS order_id')) return { rows: [] }
      return { rows: [] }
    },
    release() { this.released = true },
  }
  const handlers = createEdgeCallHandlers({ pool: { connect: async () => client } })
  const res = response()
  await handlers.pending(request(), res)
  assert.equal(res.statusCode, 204)
  assert.equal(res.ended, true)
  assert.ok(queries.includes('COMMIT'))
  assert.equal(client.released, true)
})

test('pending call queue reports unapplied migration as 503, not generic 500', async () => {
  const client = {
    async query(sql) {
      if (sql === 'BEGIN') return { rows: [] }
      const error = new Error('relation "public.edge_voice_calls" does not exist')
      error.code = '42P01'
      throw error
    },
    release() { this.released = true },
  }
  const handlers = createEdgeCallHandlers({ pool: { connect: async () => client } })
  const res = response()
  await handlers.pending(request(), res)
  assert.equal(res.statusCode, 503)
  assert.deepEqual(res.body, { error: 'Call queue migration is not applied.' })
  assert.equal(client.released, true)
})
