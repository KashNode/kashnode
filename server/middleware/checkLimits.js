export function createCheckLimits({ pool }) {
  return async function checkLimits(req, res, next) {
    if (!pool) {
      return res.status(503).json({ status: 'error', message: 'Subscription service is unavailable.' })
    }

    // Authentication or webhook-signature middleware must establish this
    // context before the limit check. Never trust a merchant ID from the body.
    const merchantId = req.merchant?.id || req.session?.user?.merchantId
    if (!merchantId) {
      return res.status(401).json({ status: 'error', message: 'Authenticated merchant context is required.' })
    }

    try {
      const result = await pool.query(
        `SELECT id, subscription_plan, available_orders
         FROM public.merchants
         WHERE id = $1
         LIMIT 1`,
        [merchantId],
      )
      const merchant = result.rows[0]
      if (!merchant) {
        return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' })
      }

      const availableOrders = Number(merchant.available_orders)
      req.merchant = { ...req.merchant, ...merchant, available_orders: availableOrders }
      if (!Number.isFinite(availableOrders) || availableOrders <= 0) {
        return res.status(403).json({
          status: 'error',
          code: 'LIMIT_EXCEEDED',
          message: 'Limit Exceeded',
          limit: 'available_orders',
          subscriptionPlan: merchant.subscription_plan,
        })
      }

      return next()
    } catch (error) {
      return next(error)
    }
  }
}
