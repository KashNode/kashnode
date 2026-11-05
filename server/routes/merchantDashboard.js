const DEFAULT_DATA_QUOTA_MB = 10240;

function merchantSession(req) {
  const user = req.session?.user;
  if (!user?.id || !user?.merchantId || user.role === 'admin') return null;
  return { userId: String(user.id), merchantId: String(user.merchantId) };
}

export function createMerchantDashboardHandlers({ pool, defaultDataQuotaMb = DEFAULT_DATA_QUOTA_MB } = {}) {
  async function getCalls(req, res) {
    const identity = merchantSession(req);
    if (!identity) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'Call history is unavailable.' });

    const result = await pool.query(
      `SELECT
         ledger.id,
         orders.customer_phone,
         ledger.created_at,
         ledger.call_duration_seconds,
         ledger.billed_amount,
         ledger.currency,
         ledger.billing_source
       FROM public.call_billing_ledger AS ledger
       JOIN public.orders AS orders
         ON orders.id = ledger.order_id
        AND orders.merchant_id = ledger.merchant_id
       JOIN public.merchants AS merchant
         ON merchant.id = ledger.merchant_id
        AND merchant.owner_user_id = $2::uuid
       WHERE ledger.merchant_id = $1::uuid
       ORDER BY ledger.created_at DESC
       LIMIT 100`,
      [identity.merchantId, identity.userId],
    );

    return res.json({
      source: 'billing_ledger',
      calls: (result.rows || []).map(row => ({
        id: String(row.id),
        phone: row.customer_phone || 'Customer phone unavailable',
        occurredAt: row.created_at,
        durationSeconds: Number(row.call_duration_seconds || 0),
        status: 'Completed',
        summary: row.billing_source === 'wallet'
          ? 'Voice session billed to wallet.'
          : row.billing_source === 'voice_minutes'
            ? 'Voice session covered by prepaid minutes.'
            : 'Voice session covered by included usage.',
        billedAmount: Number(row.billed_amount || 0),
        currency: row.currency || 'BDT',
        billingSource: row.billing_source,
        recordingUrl: null,
      })),
    });
  }

  async function getSim(req, res) {
    const identity = merchantSession(req);
    if (!identity) return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' });
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'SIM status is unavailable.' });

    const result = await pool.query(
      `SELECT
         merchant.box_device_id,
         device.device_id,
         device.balance_bdt,
         device.data_mb,
         device.signal_strength,
         device.raw_payload,
         device.created_at,
         CASE
           WHEN device.created_at >= NOW() - INTERVAL '2 minutes'
            AND COALESCE(device.raw_payload->>'online', 'true') = 'true'
           THEN TRUE
           ELSE FALSE
         END AS online
       FROM public.merchants AS merchant
       LEFT JOIN LATERAL (
         SELECT logs.device_id, logs.balance_bdt, logs.data_mb,
                logs.signal_strength, logs.raw_payload, logs.created_at
           FROM public.device_logs AS logs
          WHERE logs.merchant_id = merchant.id
            AND logs.device_id = merchant.box_device_id
          ORDER BY logs.created_at DESC
          LIMIT 1
       ) AS device ON TRUE
       WHERE merchant.id = $1::uuid
         AND merchant.owner_user_id = $2::uuid
       LIMIT 1`,
      [identity.merchantId, identity.userId],
    );

    const row = result.rows?.[0];
    if (!row) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' });
    if (!row.device_id) return res.json({ source: 'database', sim: null });

    return res.json({
      source: 'database',
      sim: {
        deviceId: row.device_id,
        balance: Number(row.balance_bdt || 0),
        internetDataMb: Number(row.data_mb || 0),
        dataQuotaMb: Number(row.raw_payload?.dataQuotaMb ?? defaultDataQuotaMb),
        signalStrength: Number(row.signal_strength || 0),
        networkType: row.raw_payload?.networkType || 'Unknown',
        online: Boolean(row.online),
        updatedAt: row.created_at,
        source: 'database',
      },
    });
  }

  return { getCalls, getSim };
}
