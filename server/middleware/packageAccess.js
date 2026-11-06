function normalizePackage(value) { return String(value || '').trim().toLowerCase(); }

function upgradeRequired(res, activePlan, requiredPlan) {
  return res.status(403).json({
    status: 'error',
    code: 'PACKAGE_UPGRADE_REQUIRED',
    activePlan,
    requiredPlan,
    message: `This feature requires the ${requiredPlan[0].toUpperCase()}${requiredPlan.slice(1)} package or higher.`,
  });
}

/** Resolve tier from the database on every request; never trust session/body tier values. */
export function createRequirePackage({ pool, minimumPackage, credentialHeader = null } = {}) {
  const requiredPlan = normalizePackage(minimumPackage);
  if (pool && typeof pool.query !== 'function') throw new TypeError('Package gating requires a PostgreSQL pool.');
  if (credentialHeader && credentialHeader !== 'x-merchant-secret') {
    throw new TypeError('Unsupported package credential header.');
  }

  return async function requirePackage(req, res, next) {
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'Package access service is unavailable.' });
    try {
      let result;
      if (credentialHeader === 'x-merchant-secret') {
        const secret = req.get?.(credentialHeader) || '';
        if (typeof secret !== 'string' || secret.length < 32 || secret.length > 255) {
          return res.status(401).json({ status: 'error', message: 'Invalid merchant credentials.' });
        }
        result = await pool.query(
          'SELECT m.id, m.subscription_plan, p.display_order AS plan_rank FROM public.merchants m JOIN public.subscription_plans p ON lower(p.slug)=lower(m.subscription_plan) AND p.is_active=TRUE WHERE m.webhook_secret = $1 LIMIT 1',
          [secret],
        );
      } else {
        const user = req.session?.user;
        if (!user?.id || !user?.merchantId || user.role === 'admin') {
          return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });
        }
        result = await pool.query(
          'SELECT m.id, m.subscription_plan, p.display_order AS plan_rank FROM public.merchants m JOIN public.subscription_plans p ON lower(p.slug)=lower(m.subscription_plan) AND p.is_active=TRUE WHERE m.id = $1 AND m.owner_user_id = $2 LIMIT 1',
          [user.merchantId, user.id],
        );
      }

      const merchant = result.rows?.[0];
      if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });
      const activePlan = normalizePackage(merchant.subscription_plan);
      const required = await pool.query('SELECT display_order FROM public.subscription_plans WHERE lower(slug)=lower($1) AND is_active=TRUE LIMIT 1', [requiredPlan]);
      if (!required.rows[0]) return res.status(503).json({ status: 'error', message: 'Required package is not configured.' });
      if (Number(merchant.plan_rank) < Number(required.rows[0].display_order)) {
        return upgradeRequired(res, activePlan, requiredPlan);
      }

      req.merchant = { ...req.merchant, ...merchant, subscription_plan: activePlan };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function normalizeMerchantPackage(plan) {
  return normalizePackage(plan);
}
