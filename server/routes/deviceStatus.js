export function createDeviceStatusHandler({
  pool,
  deviceId: expectedDeviceId = '',
  dataQuotaMb = 10240,
  logger = console,
} = {}) {
  return async function postDeviceStatus(req, res) {
    const secret = req.get?.('x-merchant-secret') || req.headers?.['x-merchant-secret'] || '';
    if (typeof secret !== 'string' || secret.length < 32 || secret.length > 255) {
      return res.status(401).json({
        status: 'error',
        message: 'A valid merchant device credential is required in x-merchant-secret.',
      });
    }

    const body = req.body || {};
    const incomingDeviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
    if (!incomingDeviceId || incomingDeviceId.length > 128) {
      return res.status(400).json({ status: 'error', message: 'A valid deviceId is required.' });
    }
    if (expectedDeviceId && incomingDeviceId !== expectedDeviceId) {
      return res.status(403).json({ status: 'error', message: 'This device is not registered.' });
    }

    const networkType = typeof body.networkType === 'string' ? body.networkType.trim().slice(0, 24) : '4G LTE';
    const online = body.online !== false;
    const quota = body.dataQuotaMb === undefined ? Number(dataQuotaMb) : Number(body.dataQuotaMb);
    const values = [body.balance, body.internetDataMb, body.signalStrength, quota].map(Number);
    if (values.some(value => !Number.isFinite(value))
      || values[0] < 0 || values[1] < 0 || values[2] < 0 || values[2] > 5 || values[3] <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Expected balance >= 0, internetDataMb >= 0, dataQuotaMb > 0, and signalStrength between 0 and 5.',
      });
    }
    if (!pool?.query) return res.status(503).json({ status: 'error', message: 'Device status storage is unavailable.' });

    const merchantResult = await pool.query(
      `SELECT id
         FROM public.merchants
        WHERE webhook_secret = $1
          AND is_onboarding_complete = TRUE
        LIMIT 1`,
      [secret],
    );
    const merchant = merchantResult.rows?.[0];
    if (!merchant?.id) {
      return res.status(401).json({ status: 'error', message: 'The device credential is not linked to an onboarded merchant.' });
    }

    try {
      const registration = await pool.query(
        `UPDATE public.merchants
            SET box_device_id = COALESCE(box_device_id, $2)
          WHERE id = $1
            AND (box_device_id IS NULL OR box_device_id = $2)
          RETURNING id`,
        [merchant.id, incomingDeviceId],
      );
      if (!registration.rows?.[0]) {
        return res.status(409).json({
          status: 'error',
          message: 'This merchant is already paired with a different device. Ask an administrator to reset the pairing.',
        });
      }

      const rawPayload = { dataQuotaMb: values[3], networkType, online };
      const inserted = await pool.query(
        `INSERT INTO public.device_logs
          (merchant_id, device_id, balance_bdt, data_mb, signal_strength, raw_payload)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)
         RETURNING created_at`,
        [merchant.id, incomingDeviceId, values[0], values[1], values[2], JSON.stringify(rawPayload)],
      );
      const updatedAt = inserted.rows?.[0]?.created_at || new Date().toISOString();
      try {
        logger?.info?.('[KashNode Box Sync]', {
          merchantId: String(merchant.id),
          deviceId: incomingDeviceId,
          signalStrength: values[2],
          online,
        });
      } catch { /* telemetry logging is best effort */ }
      return res.status(202).json({ status: 'success', message: 'SIM status synced successfully.', updatedAt });
    } catch (error) {
      if (error?.code === '23505') {
        return res.status(409).json({ status: 'error', message: 'This device is already paired with another merchant.' });
      }
      throw error;
    }
  };
}
