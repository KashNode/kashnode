import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlanCatalogHandlers } from '../server/routes/adminPlans.js'

const initialPlan = {
  slug: 'standard', name: 'Standard', tagline: 'For growing teams',
  monthly_fee: '0.00', included_minutes: 100, price_per_minute: '6.50',
  minimum_topup_minutes: 100, currency: 'BDT', billing_unit: 'minute',
  short_features: [], details: [], feature_groups: [], display_order: 2,
  is_active: true, updated_at: '2026-11-07T00:00:00.000Z',
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

function makePool() {
  let plan = { ...initialPlan }
  const pool = {
    async query(sql, params = []) {
      if (sql.includes('UPDATE public.subscription_plans')) {
        const [slug, monthlyFee, includedMinutes, rate, minimum, active] = params
        if (slug.toLowerCase() !== plan.slug) return { rows: [] }
        plan = {
          ...plan, monthly_fee: monthlyFee, included_minutes: includedMinutes,
          price_per_minute: rate, minimum_topup_minutes: minimum,
          is_active: active, updated_at: '2026-11-07T01:00:00.000Z',
        }
        return { rows: [{ ...plan }] }
      }
      if (sql.includes('FROM public.subscription_plans WHERE is_active = true')) {
        return { rows: plan.is_active ? [{ ...plan }] : [] }
      }
      if (sql.includes('FROM public.subscription_plans')) return { rows: [{ ...plan }] }
      throw new Error('Unexpected SQL: ' + sql)
    },
  }
  return pool
}

const validInput = {
  monthly_fee: '199.50',
  included_minutes: '250',
  price_per_minute: '5.75',
  minimum_topup_minutes: '50',
  is_active: 'true',
}

test('updates a plan atomically using sanitized numeric and boolean values and returns HTTP 200', async () => {
  const pool = makePool()
  const handlers = createPlanCatalogHandlers({ pool })
  const res = responseRecorder()
  await handlers.updatePlan({ params: { slug: 'standard' }, body: validInput }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.source, 'database')
  assert.equal(res.body.plan.monthly_fee, 199.5)
  assert.equal(res.body.plan.included_minutes, 250)
  assert.equal(res.body.plan.price_per_minute, 5.75)
  assert.equal(res.body.plan.minimum_topup_minutes, 50)
  assert.equal(res.body.plan.is_active, true)
})

test('updated plan is immediately visible from both public and admin catalog handlers', async () => {
  const handlers = createPlanCatalogHandlers({ pool: makePool() })
  const updateResponse = responseRecorder()
  await handlers.updatePlan({ params: { slug: 'standard' }, body: validInput }, updateResponse)
  assert.equal(updateResponse.statusCode, 200)

  const publicResponse = responseRecorder()
  await handlers.getPublicPlans({}, publicResponse)
  assert.equal(publicResponse.statusCode, 200)
  assert.equal(publicResponse.body.plans[0].monthly_fee, 199.5)
  assert.equal(publicResponse.body.plans[0].included_minutes, 250)

  const adminResponse = responseRecorder()
  await handlers.getAdminPlans({}, adminResponse)
  assert.equal(adminResponse.statusCode, 200)
  assert.equal(adminResponse.body.plans[0].price_per_minute, 5.75)
  assert.equal(adminResponse.body.plans[0].minimum_topup_minutes, 50)
})

test('returns field-specific HTTP 400 validation errors and does not update the database', async () => {
  let updateCalls = 0
  const pool = makePool()
  const originalQuery = pool.query.bind(pool)
  pool.query = async (...args) => {
    if (args[0].includes('UPDATE public.subscription_plans')) updateCalls += 1
    return originalQuery(...args)
  }
  const handlers = createPlanCatalogHandlers({ pool })
  const cases = [
    [{ ...validInput, monthly_fee: '-1' }, 'monthly_fee must be at least 0.'],
    [{ ...validInput, included_minutes: '1.5' }, 'included_minutes must be a whole number.'],
    [{ ...validInput, price_per_minute: 'NaN' }, 'price_per_minute must be a finite number.'],
    [{ ...validInput, minimum_topup_minutes: '0' }, 'minimum_topup_minutes must be at least 1.'],
    [{ ...validInput, is_active: 'enabled' }, 'is_active must be true or false.'],
  ]
  for (const [body, message] of cases) {
    const res = responseRecorder()
    await handlers.updatePlan({ params: { slug: 'standard' }, body }, res)
    assert.equal(res.statusCode, 400)
    assert.equal(res.body.message, message)
  }
  assert.equal(updateCalls, 0)
})

test('returns descriptive 500 response when the database update fails', async () => {
  const handlers = createPlanCatalogHandlers({ pool: { query: async () => { throw new Error('database unavailable') } } })
  const res = responseRecorder()
  await handlers.updatePlan({ params: { slug: 'standard' }, body: validInput }, res)
  assert.equal(res.statusCode, 500)
  assert.match(res.body.message, /database update failed/)
})
