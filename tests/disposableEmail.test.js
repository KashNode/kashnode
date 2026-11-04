import test from 'node:test'
import assert from 'node:assert/strict'
import { clearDisposableEmailCache, isDisposableEmail } from '../server/services/disposableEmail.js'

test('rejects well-known disposable providers without relying on a remote response', async () => {
  clearDisposableEmailCache()
  assert.equal(await isDisposableEmail('customer@10minutemail.com', { fetchImpl: async () => assert.fail('no API call expected') }), true)
  assert.equal(await isDisposableEmail('customer@mailinator.com', { fetchImpl: async () => assert.fail('no API call expected') }), true)
})

test('checks and caches permanent domains using the disposable-domain API', async () => {
  clearDisposableEmailCache()
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return new Response(JSON.stringify({ disposable: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  assert.equal(await isDisposableEmail('owner@shop.example', { fetchImpl }), false)
  assert.equal(await isDisposableEmail('another@shop.example', { fetchImpl }), false)
  assert.equal(calls, 1)
})

test('fails closed when the disposable-domain API is unavailable', async () => {
  clearDisposableEmailCache()
  await assert.rejects(
    isDisposableEmail('owner@unlisted-business.example', { fetchImpl: async () => { throw new Error('network down') } }),
    /Disposable email verification is temporarily unavailable/,
  )
})
