const PLAN_FIELDS = ['monthly_fee', 'included_minutes', 'price_per_minute', 'minimum_topup_minutes', 'is_active']

function parseNumber(value, field, { integer = false, min = 0 } = {}) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return { error: `${field} is required and must be a number.` }
  }
  if (typeof value === 'string' && value.trim() === '') {
    return { error: `${field} is required and must be a number.` }
  }
  const parsed = typeof value === 'number' ? value : Number(value.trim())
  if (!Number.isFinite(parsed)) return { error: `${field} must be a finite number.` }
  if (parsed < min) return { error: `${field} must be at least ${min}.` }
  if (integer && !Number.isSafeInteger(parsed)) return { error: `${field} must be a whole number.` }
  if (!integer && Math.round(parsed * 100) !== parsed * 100) {
    return { error: `${field} may have at most 2 decimal places.` }
  }
  return { value: parsed }
}

function parseActive(value) {
  if (typeof value === 'boolean') return { value }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return { value: true }
    if (normalized === 'false') return { value: false }
  }
  return { error: 'is_active must be true or false.' }
}

export function validatePlanUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' }
  }
  const parsed = {
    monthly_fee: parseNumber(body.monthly_fee, 'monthly_fee'),
    included_minutes: parseNumber(body.included_minutes, 'included_minutes', { integer: true }),
    price_per_minute: parseNumber(body.price_per_minute, 'price_per_minute'),
    minimum_topup_minutes: parseNumber(body.minimum_topup_minutes, 'minimum_topup_minutes', { integer: true, min: 1 }),
    is_active: parseActive(body.is_active),
  }
  for (const field of PLAN_FIELDS) {
    if (parsed[field].error) return { error: parsed[field].error, field }
  }
  return { value: Object.fromEntries(PLAN_FIELDS.map(field => [field, parsed[field].value])) }
}

const CATALOG_COLUMNS = `slug, name, tagline, monthly_fee, included_minutes, price_per_minute,
  minimum_topup_minutes, currency, billing_unit, short_features, details, feature_groups,
  display_order, is_active, updated_at`

export function createPlanCatalogHandlers({ pool }) {
  async function getPublicPlans(_req, res) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Package catalog is temporarily unavailable.' })
    try {
      const result = await pool.query(`SELECT ${CATALOG_COLUMNS}
        FROM public.subscription_plans WHERE is_active = true ORDER BY display_order ASC`)
      return res.status(200).json({ source: 'database', plans: result.rows })
    } catch (error) {
      console.error('[KashNode Plans] Public catalog read failed:', error)
      return res.status(500).json({ status: 'error', message: 'Could not load the subscription plan catalog.' })
    }
  }

  async function getAdminPlans(_req, res) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Database unavailable.' })
    try {
      const result = await pool.query(`SELECT ${CATALOG_COLUMNS}
        FROM public.subscription_plans ORDER BY display_order ASC`)
      return res.status(200).json({ source: 'database', plans: result.rows })
    } catch (error) {
      console.error('[KashNode Plans] Admin catalog read failed:', error)
      return res.status(500).json({ status: 'error', message: 'Could not load the admin plan catalog.' })
    }
  }

  async function updatePlan(req, res) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Database unavailable.' })
    const slug = typeof req.params?.slug === 'string' ? req.params.slug.trim() : ''
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(slug)) {
      return res.status(400).json({ status: 'error', message: 'Plan slug is invalid.' })
    }
    const validation = validatePlanUpdate(req.body)
    if (validation.error) {
      return res.status(400).json({ status: 'error', field: validation.field, message: validation.error })
    }
    const { monthly_fee, included_minutes, price_per_minute, minimum_topup_minutes, is_active } = validation.value
    try {
      const result = await pool.query(`UPDATE public.subscription_plans
        SET monthly_fee = $2,
            included_minutes = $3,
            price_per_minute = $4,
            minimum_topup_minutes = $5,
            is_active = $6,
            updated_at = NOW()
        WHERE lower(slug) = lower($1)
        RETURNING ${CATALOG_COLUMNS}`,
      [slug, monthly_fee, included_minutes, price_per_minute, minimum_topup_minutes, is_active])
      if (!result.rows[0]) return res.status(404).json({ status: 'error', message: `Plan "${slug}" was not found.` })
      return res.status(200).json({ source: 'database', plan: result.rows[0] })
    } catch (error) {
      console.error('[KashNode Plans] Plan update failed:', error)
      return res.status(500).json({ status: 'error', message: 'The plan could not be saved because the database update failed.' })
    }
  }

  return { getPublicPlans, getAdminPlans, updatePlan }
}
