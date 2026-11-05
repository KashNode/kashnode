import test from 'node:test'
import assert from 'node:assert/strict'
import { sendSignupOtpEmail } from '../server/services/emailService.js'

const base = {
  to: 'owner@example.net',
  name: 'Test Merchant',
  otp: '123456',
  apiKey: 're_test_key',
  from: 'KashNode <no-reply@mailer.example.com>',
}

test('posts an OTP email to Resend and returns its provider message id', async () => {
  let request
  const result = await sendSignupOtpEmail({
    ...base,
    fetchImpl: async (url, options) => {
      request = { url, options }
      return new Response(JSON.stringify({ id: 'email_test_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  assert.equal(request.url, 'https://api.resend.com/emails')
  assert.equal(request.options.method, 'POST')
  assert.equal(request.options.headers.Authorization, 'Bearer re_test_key')
  const payload = JSON.parse(request.options.body)
  assert.equal(payload.from, base.from)
  assert.deepEqual(payload.to, [base.to])
  assert.match(payload.text, /123456/)
  assert.equal(result.id, 'email_test_123')
})

test('rejects a public Gmail sender before making a provider request', async () => {
  let called = false
  await assert.rejects(
    sendSignupOtpEmail({
      ...base,
      from: 'KashNode <account@gmail.com>',
      fetchImpl: async () => { called = true; throw new Error('should not call Resend') },
    }),
    error => error.code === 'EMAIL_SENDER_DOMAIN_UNVERIFIABLE' && error.statusCode === 503,
  )
  assert.equal(called, false)
})

test('fails clearly when the Resend key or sender is missing', async () => {
  await assert.rejects(
    sendSignupOtpEmail({ ...base, apiKey: '' }),
    error => error.code === 'RESEND_API_KEY_MISSING' && error.statusCode === 503,
  )
  await assert.rejects(
    sendSignupOtpEmail({ ...base, from: '' }),
    error => error.code === 'AUTH_EMAIL_FROM_MISSING' && error.statusCode === 503,
  )
})

test('surfaces Resend 403 domain rejection without treating it as success', async () => {
  await assert.rejects(
    sendSignupOtpEmail({
      ...base,
      fetchImpl: async () => new Response(JSON.stringify({
        message: 'The example.net domain is not verified.',
        name: 'validation_error',
        statusCode: 403,
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    }),
    error => error.code === 'validation_error'
      && error.statusCode === 502
      && /domain is not verified/.test(error.message),
  )
})
