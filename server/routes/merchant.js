function cleanText(value, maxLength = 255) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}

function normalizeBangladeshPhone(value) {
  if (typeof value !== 'string') return null;

  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00880')) digits = '0' + digits.slice(5);
  else if (digits.startsWith('880')) digits = '0' + digits.slice(3);

  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

function normalizeWebsiteUrl(value) {
  if (value == null || value === '') return { value: null };
  if (typeof value !== 'string' || value.trim().length > 2048) return { error: true };

  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      return { error: true };
    }
    return { value: url.toString() };
  } catch {
    return { error: true };
  }
}

function getMerchantIdentity(req) {
  const user = req.session?.user;
  if (!user?.id || !user?.merchantId || user.role === 'admin') return null;
  return { userId: String(user.id), merchantId: String(user.merchantId) };
}

export function createMerchantOnboardingHandlers({ pool }) {
  async function getOnboarding(req, res) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });

    const identity = getMerchantIdentity(req);
    if (!identity) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });

    const result = await pool.query(
      'SELECT is_onboarding_complete, business_name, website_url, admin_contact_phone, box_sim_phone, subscription_plan, gateway_preference, gateway_mode, billing_phone, is_billing_phone_verified, box_fulfillment_status, box_preorder_requested_at FROM public.merchants WHERE id = $1 AND owner_user_id = $2 LIMIT 1',
      [identity.merchantId, identity.userId],
    );
    const merchant = result.rows[0];
    if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });

    return res.json({
      status: 'success',
      onboarding: {
        isOnboardingComplete: Boolean(merchant.is_onboarding_complete),
        businessName: merchant.business_name || '',
        websiteUrl: merchant.website_url || '',
        adminContactPhone: merchant.admin_contact_phone || '',
        boxSimPhone: merchant.box_sim_phone || '',
        selectedPlan: merchant.subscription_plan || 'basic',
        gatewayPreference: merchant.gateway_preference || 'app',
        gatewayMode: merchant.gateway_mode || 'android_app',
        billingPhone: merchant.billing_phone || '',
        isBillingPhoneVerified: Boolean(merchant.is_billing_phone_verified),
        boxFulfillmentStatus: merchant.box_fulfillment_status || 'not_requested',
        boxPreorderRequestedAt: merchant.box_preorder_requested_at || null,
      },
    });
  }

  async function postOnboarding(req, res) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });

    const identity = getMerchantIdentity(req);
    if (!identity) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });

    const businessName = cleanText(req.body?.businessName, 255);
    const adminContactPhone = normalizeBangladeshPhone(req.body?.adminContactPhone);
    const boxSimPhone = normalizeBangladeshPhone(req.body?.boxSimPhone);
    const website = normalizeWebsiteUrl(req.body?.websiteUrl);

    // Reject malformed input before any database access. Besides avoiding
    // unnecessary queries, this keeps validation errors deterministic even
    // when the merchant workspace does not exist.
    if (businessName.length < 2) {
      return res.status(400).json({ status: 'error', message: 'Business name must be at least 2 characters.' });
    }
    if (!adminContactPhone) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid Bangladesh mobile number for the admin contact.' });
    }
    if (website.error) {
      return res.status(400).json({ status: 'error', message: 'Website must be a valid http:// or https:// URL.' });
    }

    const gatewayMode = req.body?.gatewayMode === 'kashnode_box' ? 'kashnode_box' : 'android_app';
    const current = await pool.query('SELECT is_billing_phone_verified, billing_phone FROM public.merchants WHERE id = $1 AND owner_user_id = $2 LIMIT 1', [identity.merchantId, identity.userId]);
    if (!current.rows[0]) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });
    if (!current.rows[0].is_billing_phone_verified || !current.rows[0].billing_phone) return res.status(403).json({ status: 'error', message: 'Verify your primary billing MFS number before completing setup.' });
    const gatewayPreference = gatewayMode === 'kashnode_box' ? 'box' : 'app';
    if (gatewayPreference === 'box' && !boxSimPhone) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid Bangladesh mobile number for the Pocket Box SIM.' });
    }

    const result = await pool.query(
      'UPDATE public.merchants SET business_name = $3, website_url = $4, admin_contact_phone = $5, box_sim_phone = $6, gateway_mode = $7, gateway_preference = $8, is_onboarding_complete = TRUE WHERE id = $1 AND owner_user_id = $2 RETURNING is_onboarding_complete, business_name, website_url, admin_contact_phone, box_sim_phone, subscription_plan, gateway_preference, gateway_mode, billing_phone, is_billing_phone_verified, box_fulfillment_status',
      [
        identity.merchantId,
        identity.userId,
        businessName,
        website.value,
        adminContactPhone,
        boxSimPhone,
        gatewayMode,
        gatewayPreference,
      ],
    );

    const merchant = result.rows[0];
    if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });

    return res.json({
      status: 'success',
      message: 'Merchant onboarding completed.',
      onboarding: {
        isOnboardingComplete: Boolean(merchant.is_onboarding_complete),
        businessName: merchant.business_name,
        websiteUrl: merchant.website_url || '',
        adminContactPhone: merchant.admin_contact_phone,
        boxSimPhone: merchant.box_sim_phone || '',
        gatewayPreference: merchant.gateway_preference || gatewayPreference,
        gatewayMode: merchant.gateway_mode || gatewayMode,
        billingPhone: merchant.billing_phone || '',
        isBillingPhoneVerified: Boolean(merchant.is_billing_phone_verified),
        selectedPlan: merchant.subscription_plan || 'basic',
        boxFulfillmentStatus: merchant.box_fulfillment_status || 'not_requested',
      },
    });
  }

  async function getCredentials(req, res) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Database unavailable.' });

    const identity = getMerchantIdentity(req);
    if (!identity) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });

    const result = await pool.query(
      'SELECT webhook_secret, is_onboarding_complete FROM public.merchants WHERE id = $1 AND owner_user_id = $2 LIMIT 1',
      [identity.merchantId, identity.userId],
    );
    const merchant = result.rows[0];
    if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });
    if (!merchant.is_onboarding_complete) {
      return res.status(403).json({ status: 'error', message: 'Complete merchant onboarding before viewing API credentials.' });
    }

    return res.json({
      status: 'success',
      merchantSecretKey: merchant.webhook_secret,
    });
  }

  return { getOnboarding, postOnboarding, getCredentials };
}
