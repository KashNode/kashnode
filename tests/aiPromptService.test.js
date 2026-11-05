import test from 'node:test'
import assert from 'node:assert/strict'
import { generateOrderVoiceScript } from '../server/services/aiPromptService.js'

const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const PHONE = '01712345678'

function makeOrder(overrides = {}) {
  return {
    id: ORDER_ID,
    platform_order_id: 'wc-7001',
    customer_name: 'Ayesha Rahman',
    customer_phone: PHONE,
    total_amount: '1499.50',
    payment_method: 'cod',
    payment_status: 'unpaid',
    line_items: [
      { name: 'Premium Cotton Panjabi', quantity: 2 },
      { name: 'Leather Wallet', quantity: 1 },
    ],
    currency: 'BDT',
    wallet_balance: '100.00',
    available_voice_minutes: 0,
    ...overrides,
  }
}

function createPool(order = makeOrder()) {
  const calls = []
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params })
      return { rows: order ? [order] : [] }
    },
  }
}

function providerResponse(content, status = 200, model = 'mock-model') {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify({
        model,
        choices: [{ finish_reason: 'stop', message: { content } }],
      })
    },
  }
}

function captureLogger() {
  const entries = []
  return {
    entries,
    info: (_label, entry) => entries.push({ level: 'info', ...entry }),
    warn: (_label, entry) => entries.push({ level: 'warn', ...entry }),
    error: (_label, entry) => entries.push({ level: 'error', ...entry }),
  }
}

test('blocks paid LLM calls when wallet and prepaid voice minutes are exhausted', async () => {
  const pool = createPool(makeOrder({ wallet_balance: '0.00', available_voice_minutes: 0 }))
  let fetchCalled = false
  const result = await generateOrderVoiceScript({
    pool,
    orderId: ORDER_ID,
    env: { OPENAI_API_KEY: 'test-openai-key' },
    logger: captureLogger(),
    fetchImpl: async () => { fetchCalled = true; throw new Error('must not call') },
  })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'INSUFFICIENT_VOICE_CREDIT')
  assert.equal(fetchCalled, false)
})

test('generates a COD confirmation script from the saved order without sending the phone to the LLM', async () => {
  const pool = createPool()
  const logger = captureLogger()
  let requestBody

  const result = await generateOrderVoiceScript({
    pool,
    orderId: ORDER_ID,
    provider: 'openai',
    env: { OPENAI_API_KEY: 'test-openai-key' },
    logger,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/chat/completions')
      requestBody = JSON.parse(options.body)
      return providerResponse(JSON.stringify({
        speech_text: 'আসসালামু আলাইকুম আয়েশা। আপনার দুটি প্রিমিয়াম কটন পাঞ্জাবি এবং একটি লেদার ওয়ালেটের অর্ডারটি পেয়েছি। মোট ১৪৯৯ টাকা ৫০ পয়সা। আপনি কি অর্ডারটি নিশ্চিত করছেন?',
      }))
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.systemContext.role, 'system')
  assert.match(result.systemContext.content, /MERCHANT_CONTEXT_JSON/)
  assert.match(result.systemContext.content, /ORDER_CONTEXT_JSON/)
  assert.match(result.systemContext.content, /COD:/)
  assert.equal(result.provider, 'openai')
  assert.equal(result.intent, 'cod_confirmation')
  assert.equal(result.tts.text, result.speechText)
  assert.deepEqual(result.tts.openai, { input: result.speechText })
  assert.deepEqual(result.tts.deepgram, { text: result.speechText })
  assert.equal(result.tts.language, 'bn-BD')
  assert.match(requestBody.messages[0].content, /MUST clearly ask the customer to confirm/)
  assert.match(requestBody.messages[0].content, /Do not claim payment received/)
  assert.match(requestBody.messages[1].content, /Premium Cotton Panjabi/)
  assert.match(requestBody.messages[1].content, /1499\.50/)
  assert.equal(JSON.stringify(requestBody).includes(PHONE), false)
  assert.match(requestBody.response_format.type, /json_schema/)
  assert.equal(pool.calls.length, 1)
  assert.deepEqual(logger.entries[0], {
    level: 'info',
    event: 'voice_script_generated',
    orderId: ORDER_ID,
    provider: 'openai',
    intent: 'cod_confirmation',
  })
})

test('paid bKash order instructs the AI to state payment received and parcel preparation', async () => {
  const pool = createPool(makeOrder({ payment_method: 'bkash', payment_status: 'paid' }))
  let requestBody
  const result = await generateOrderVoiceScript({
    pool,
    orderId: ORDER_ID,
    provider: 'openai',
    env: { OPENAI_API_KEY: 'test-openai-key' },
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body)
      return providerResponse(JSON.stringify({
        speech_text: 'আপনার বিকাশের পেমেন্ট আমরা পেয়েছি। আপনার পার্সেলটি প্রস্তুত করা হচ্ছে।',
      }))
    },
  })

  assert.equal(result.ok, true)
  assert.match(result.systemContext.content, /PAID:/)
  assert.equal(result.intent, 'payment_received')
  assert.match(requestBody.messages[0].content, /explicitly say payment is received and the parcel is being prepared/)
  assert.doesNotMatch(requestBody.messages[0].content, /ask a direct question confirming/)
})

test('does not claim payment received when a bKash order is not marked paid', async () => {
  const pool = createPool(makeOrder({ payment_method: 'bKash', payment_status: 'unpaid' }))
  let requestBody
  const result = await generateOrderVoiceScript({
    pool,
    orderId: ORDER_ID,
    env: { OPENAI_API_KEY: 'test-openai-key' },
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body)
      return providerResponse(JSON.stringify({ speech_text: 'আপনার পেমেন্ট এখনো নিশ্চিত হয়নি।' }))
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.intent, 'payment_pending')
  assert.match(requestBody.messages[0].content, /Payment is not verified/)
  assert.match(requestBody.messages[0].content, /Never say money has been received/)
})

test('switches to Gemini on the invocation without a process restart', async () => {
  const pool = createPool(makeOrder({ payment_method: 'nagad', payment_status: 'paid' }))
  let endpoint
  let requestBody
  const result = await generateOrderVoiceScript({
    pool,
    orderId: ORDER_ID,
    provider: 'gemini',
    env: { GEMINI_API_KEY: 'test-gemini-key', GEMINI_MODEL: 'gemini-test-model' },
    fetchImpl: async (url, options) => {
      endpoint = url
      assert.equal(options.headers['x-goog-api-key'], 'test-gemini-key')
      requestBody = JSON.parse(options.body)
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            modelVersion: 'gemini-test-model',
            candidates: [{
              finishReason: 'STOP',
              content: { parts: [{ text: JSON.stringify({ speech_text: 'আপনার নগদ পেমেন্ট গ্রহণ করা হয়েছে। পার্সেল প্রস্তুত করা হচ্ছে।' }) }] },
            }],
          })
        },
      }
    },
  })

  assert.match(endpoint, /models\/gemini-test-model:generateContent/)
  assert.match(requestBody.systemInstruction.parts[0].text, /payment was received/)
  assert.equal(requestBody.generationConfig.responseMimeType, 'application/json')
  assert.equal(result.ok, true)
  assert.equal(result.provider, 'gemini')
  assert.equal(result.intent, 'payment_received')
})

test('supports Groq JSON mode using the compatible chat completions endpoint', async () => {
  const pool = createPool()
  let requestBody
  const result = await generateOrderVoiceScript({
    pool,
    orderId: ORDER_ID,
    provider: 'groq',
    env: { GROQ_API_KEY: 'test-groq-key', GROQ_MODEL: 'llama-test' },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions')
      assert.equal(options.headers.Authorization, 'Bearer test-groq-key')
      requestBody = JSON.parse(options.body)
      return providerResponse(JSON.stringify({ speech_text: 'আপনি কি আপনার ক্যাশ অন ডেলিভারি অর্ডারটি নিশ্চিত করছেন?' }))
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.provider, 'groq')
  assert.equal(result.model, 'mock-model')
  assert.deepEqual(requestBody.response_format, { type: 'json_object' })
})

test('rejects a missing customer phone and logs no customer PII or provider request', async () => {
  const pool = createPool(makeOrder({ customer_phone: null }))
  const logger = captureLogger()
  let fetchCalled = false
  const result = await generateOrderVoiceScript({
    pool,
    orderId: ORDER_ID,
    env: { OPENAI_API_KEY: 'test-openai-key' },
    logger,
    fetchImpl: async () => { fetchCalled = true; throw new Error('must not call') },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'MISSING_CUSTOMER_PHONE')
  assert.equal(fetchCalled, false)
  assert.equal(JSON.stringify(logger.entries).includes(PHONE), false)
})

test('rejects missing payment_method safely and without calling the LLM', async () => {
  const pool = createPool(makeOrder({ payment_method: null }))
  const logger = captureLogger()
  let fetchCalled = false
  const result = await generateOrderVoiceScript({
    pool,
    orderId: ORDER_ID,
    logger,
    env: { OPENAI_API_KEY: 'test-openai-key' },
    fetchImpl: async () => { fetchCalled = true; throw new Error('must not call') },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'MISSING_PAYMENT_METHOD')
  assert.equal(fetchCalled, false)
})

test('returns a safe configuration error when a provider API key is missing', async () => {
  const result = await generateOrderVoiceScript({
    pool: createPool(),
    orderId: ORDER_ID,
    provider: 'groq',
    env: {},
    logger: captureLogger(),
    fetchImpl: async () => { throw new Error('must not call') },
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'PROVIDER_NOT_CONFIGURED')
  assert.match(result.error.message, /not configured/)
})

test('returns a safe error for unsupported providers and provider HTTP failures', async () => {
  const pool = createPool()
  const unsupported = await generateOrderVoiceScript({
    pool, orderId: ORDER_ID, provider: 'unknown', env: {}, logger: captureLogger(),
  })
  assert.equal(unsupported.ok, false)
  assert.equal(unsupported.error.code, 'UNSUPPORTED_PROVIDER')

  const failed = await generateOrderVoiceScript({
    pool,
    orderId: ORDER_ID,
    env: { OPENAI_API_KEY: 'test-openai-key' },
    logger: captureLogger(),
    fetchImpl: async () => providerResponse('', 429),
  })
  assert.equal(failed.ok, false)
  assert.equal(failed.error.code, 'PROVIDER_HTTP_ERROR')
  assert.doesNotMatch(failed.error.message, /api key|secret|429/)
})

test('rejects malformed model output before exposing it to TTS', async () => {
  const result = await generateOrderVoiceScript({
    pool: createPool(),
    orderId: ORDER_ID,
    env: { OPENAI_API_KEY: 'test-openai-key' },
    logger: captureLogger(),
    fetchImpl: async () => providerResponse('This is not JSON.'),
  })

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'INVALID_MODEL_OUTPUT')
  assert.equal(result.tts, undefined)
})
