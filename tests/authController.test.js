import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthController } from '../server/controllers/authController.js'

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
  }
}

function createPool() {
  const state = { pending: null, user: null, merchant: null, released: false }
  const client = {
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, ' ').trim()
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] }
      if (text.startsWith('DELETE FROM public.merchant_signup_otps')) {
        state.pending = null
        return { rows: [] }
      }
      if (text.includes('FROM public.merchant_signup_otps')) return { rows: state.pending ? [state.pending] : [] }
      if (text.includes('FROM public.users WHERE lower(email) = $1 FOR UPDATE')) return { rows: state.user ? [state.user] : [] }
      if (text.startsWith('INSERT INTO public.users')) {
        state.user = { id: 'user-1', email: params[0], name: params[1], role: 'user' }
        return { rows: [state.user] }
      }
      if (text.startsWith('INSERT INTO public.merchants')) {
        state.merchant = { id: 'merchant-1', name: params[0], email: params[1], owner_user_id: params[2] }
        return { rows: [state.merchant] }
      }
      if (text.startsWith('DELETE FROM public.merchant_signup_otps')) {
        state.pending = null
        return { rows: [] }
      }
      throw new Error('Unhandled mock query: ' + text)
    },
    release() { state.released = true },
  }

  return {
    state,
    pool: {
      async query(sql, params = []) {
        const text = String(sql).replace(/\s+/g, ' ').trim()
        if (text.includes('SELECT id FROM public.users')) return { rows: state.user ? [state.user] : [] }
        if (text.startsWith('INSERT INTO public.merchant_signup_otps')) {
          state.pending = {
            email: params[0],
            name: params[1],
            password_hash: params[2],
            otp_hash: params[3],
            attempts: 0,
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
          }
          return { rows: [] }
        }
        if (text.startsWith('DELETE FROM public.merchant_signup_otps')) {
          state.pending = null
          return { rows: [] }
        }
        throw new Error('Unhandled pool query: ' + text)
      },
      async connect() { return client },
    },
  }
}

test('blocks disposable email addresses before sending a signup OTP', async () => {
  const { pool } = createPool()
  let emailSent = false
  const controller = createAuthController({
    pool,
    otpSecret: 'test-otp-secret-with-at-least-32-bytes',
    checkDisposableEmail: async () => true,
    sendOtpEmail: async () => { emailSent = true },
  })
  const res = response()

  await controller.signup({ body: { name: 'Test Merchant', email: 'owner@tempmail.example', password: 'a-very-strong-password' } }, res)

  assert.equal(res.statusCode, 422)
  assert.equal(emailSent, false)
})

test('sends OTP and creates a user and free merchant only after successful verification', async () => {
  const { pool, state } = createPool()
  let sentOtp = null
  let sessionUser = null
  const controller = createAuthController({
    pool,
    otpSecret: 'test-otp-secret-with-at-least-32-bytes',
    checkDisposableEmail: async () => false,
    sendOtpEmail: async ({ otp }) => { sentOtp = otp },
    createUserSession: async (_req, user) => { sessionUser = user },
  })
  const signupResponse = response()

  await controller.signup({
    body: { name: 'Test Merchant', email: 'owner@shop.example', password: 'a-very-strong-password' },
  }, signupResponse)

  assert.equal(signupResponse.statusCode, 202)
  assert.match(sentOtp, /^\d{6}$/)
  assert.ok(state.pending)
  assert.notEqual(state.pending.otp_hash, sentOtp)

  const verifyResponse = response()
  await controller.verifyOtp({ body: { email: 'owner@shop.example', otp: sentOtp } }, verifyResponse)

  assert.equal(verifyResponse.statusCode, 201)
  assert.equal(state.user.email, 'owner@shop.example')
  assert.equal(state.merchant.owner_user_id, 'user-1')
  assert.equal(sessionUser.merchantId, 'merchant-1')
  assert.equal(state.pending, null)
  assert.equal(state.released, true)
})

test('clears the pending challenge and reports sender configuration errors clearly', async () => {
  const { pool, state } = createPool()
  const controller = createAuthController({
    pool,
    otpSecret: 'test-otp-secret-with-at-least-32-bytes',
    checkDisposableEmail: async () => false,
    sendOtpEmail: async () => {
      const error = new Error('AUTH_EMAIL_FROM uses gmail.com, which is not a verified Resend sending domain.')
      error.code = 'EMAIL_SENDER_DOMAIN_UNVERIFIABLE'
      error.statusCode = 503
      throw error
    },
  })
  const res = response()

  await controller.signup({
    body: { name: 'Test Merchant', email: 'owner@shop.example', password: 'a-very-strong-password' },
  }, res)

  assert.equal(res.statusCode, 503)
  assert.match(res.body.message, /not configured correctly/i)
  assert.equal(state.pending, null)
})
