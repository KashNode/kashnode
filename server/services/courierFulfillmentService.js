import { decryptIntegrationCredentials, encryptIntegrationCredentials } from './integrationCrypto.js';
import { createCourierOrder, refreshShopifyAccessToken, syncTrackingToStore } from './integrationProviderService.js';

const COURIERS = new Set(['steadfast', 'pathao']);

function safeError(error) {
  const message = String(error?.message || 'Courier fulfillment failed.')
    .replace(/(api[-_ ]?key|secret|password|token)\s*[:=]\s*\S+/ig, '$1=[redacted]')
    .slice(0, 400);
  return message || 'Courier fulfillment failed.';
}

async function claimNext(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, merchant_id, order_id, attempts
       FROM public.courier_fulfillment_outbox
       WHERE status IN ('pending','failed') AND next_attempt_at <= NOW()
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
    );
    const job = result.rows[0];
    if (!job) {
      await client.query('COMMIT');
      return null;
    }
    await client.query(
      "UPDATE public.courier_fulfillment_outbox SET status = 'processing', attempts = attempts + 1, updated_at = NOW() WHERE id = $1",
      [job.id],
    );
    await client.query('COMMIT');
    return { ...job, attempts: Number(job.attempts || 0) + 1 };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function completeJob(pool, jobId, status, error = null, retry = false, attempts = 1) {
  const delaySeconds = Math.min(3600, 30 * (2 ** Math.min(attempts, 7)));
  await pool.query(
    `UPDATE public.courier_fulfillment_outbox
     SET status = $2,
         last_error = $3,
         next_attempt_at = CASE WHEN $4 THEN NOW() + ($5::text || ' seconds')::interval ELSE next_attempt_at END,
         updated_at = NOW()
     WHERE id = $1`,
    [jobId, status, error, retry, delaySeconds],
  );
}

async function getStoreCredentials(pool, merchantId, storeRow) {
  if (storeRow.provider !== 'shopify') return decryptIntegrationCredentials(storeRow);

  // Serialize refresh-token rotation per shop: Shopify replaces the refresh
  // token on every successful refresh, so concurrent workers must not race.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT credentials_ciphertext, credentials_nonce, credentials_auth_tag, credentials_key_version
       FROM public.merchant_integrations
       WHERE merchant_id = $1 AND provider = 'shopify' AND is_active = TRUE
       LIMIT 1 FOR UPDATE`,
      [merchantId],
    );
    if (!result.rows[0]) throw new Error('Shopify integration is no longer connected.');
    const credentials = decryptIntegrationCredentials(result.rows[0]);
    const refreshed = await refreshShopifyAccessToken(credentials);
    if (refreshed !== credentials) {
      const encrypted = encryptIntegrationCredentials(refreshed);
      await client.query(
        `UPDATE public.merchant_integrations
         SET credentials_ciphertext = $3, credentials_nonce = $4, credentials_auth_tag = $5,
             credentials_key_version = $6, updated_at = NOW()
         WHERE merchant_id = $1 AND provider = $2`,
        [merchantId, 'shopify', encrypted.ciphertext, encrypted.nonce, encrypted.authTag, encrypted.keyVersion],
      );
    }
    await client.query('COMMIT');
    return refreshed;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function processStoreTrackingSync(pool, job, order, storeRow) {
  if (!order.store_provider) {
    await pool.query('UPDATE public.orders SET store_tracking_synced = TRUE, store_sync_error = NULL WHERE id = $1', [order.id]);
    await completeJob(pool, job.id, 'completed', null, false, job.attempts);
    return;
  }
  if (!storeRow) {
    await completeJob(pool, job.id, 'blocked', 'The originating store integration is not connected yet.', false, job.attempts);
    return;
  }
  try {
    const storeCredentials = await getStoreCredentials(pool, job.merchant_id, storeRow);
    await syncTrackingToStore(storeRow.provider, storeCredentials, order, {
      provider: order.courier_provider,
      trackingCode: order.courier_tracking_code || order.courier_consignment_id,
      consignmentId: order.courier_consignment_id,
    });
    await pool.query(
      'UPDATE public.orders SET store_tracking_synced = TRUE, store_sync_error = NULL WHERE id = $1',
      [order.id],
    );
    await pool.query(
      "UPDATE public.courier_orders SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('storeSync', 'synced') WHERE order_id = $1",
      [order.id],
    );
    await completeJob(pool, job.id, 'completed', null, false, job.attempts);
  } catch (error) {
    await pool.query('UPDATE public.orders SET store_sync_error = $2 WHERE id = $1', [order.id, safeError(error)]);
    throw error;
  }
}

async function processJob(pool, job) {
  const tierResult = await pool.query('SELECT subscription_plan FROM public.merchants WHERE id = $1 LIMIT 1', [job.merchant_id]);
  const activePlan = String(tierResult.rows?.[0]?.subscription_plan || 'basic').toLowerCase();
  if (!['standard', 'premium'].includes(activePlan)) {
    await completeJob(pool, job.id, 'blocked', 'Courier automation requires Standard or Premium.', false, job.attempts);
    return;
  }

  const orderResult = await pool.query(
    `SELECT id, merchant_id, platform_order_id, customer_name, customer_phone, alternative_phone,
            total_amount, payment_status, line_items, store_provider, store_tracking_synced, store_sync_error,
            shipping_address, shipping_city, shipping_zone, shipping_area,
            courier_provider, courier_consignment_id, courier_tracking_code
     FROM public.orders WHERE id = $1 AND merchant_id = $2 LIMIT 1`,
    [job.order_id, job.merchant_id],
  );
  const order = orderResult.rows[0];
  if (!order) {
    await completeJob(pool, job.id, 'blocked', 'Order no longer exists.', false, job.attempts);
    return;
  }

  const integrations = await pool.query(
    `SELECT provider, credentials_ciphertext, credentials_nonce, credentials_auth_tag,
            credentials_key_version, config
     FROM public.merchant_integrations
     WHERE merchant_id = $1 AND is_active = TRUE
       AND provider IN ('steadfast','pathao','woocommerce','shopify')`,
    [job.merchant_id],
  );
  const byProvider = new Map(integrations.rows.map(row => [row.provider, row]));

  // Once a consignment exists, retry only the store sync; never create a second parcel.
  if (order.courier_consignment_id) {
    if (order.store_tracking_synced) {
      await completeJob(pool, job.id, 'completed', null, false, job.attempts);
      return;
    }
    const storeRow = order.store_provider ? byProvider.get(order.store_provider) : null;
    await processStoreTrackingSync(pool, job, order, storeRow);
    return;
  }

  const enabledCouriers = integrations.rows.filter(row => COURIERS.has(row.provider) && row.config?.autoBook !== false);
  const courierRow = order.courier_provider
    ? enabledCouriers.find(row => row.provider === order.courier_provider)
    : enabledCouriers[0];
  if (!courierRow) {
    await completeJob(pool, job.id, 'blocked', 'No active auto-booking courier integration is configured.', false, job.attempts);
    return;
  }
  if (!order.shipping_address || !order.customer_phone) {
    await completeJob(pool, job.id, 'blocked', 'Order is missing a delivery address or customer phone.', false, job.attempts);
    return;
  }
  if (courierRow.provider === 'pathao' && (!/^\d+$/.test(String(order.shipping_city || '')) || !/^\d+$/.test(String(order.shipping_zone || '')))) {
    await completeJob(pool, job.id, 'blocked', 'Pathao orders require city and zone IDs in the source order metadata.', false, job.attempts);
    return;
  }

  const courierCredentials = decryptIntegrationCredentials(courierRow);
  const booking = await createCourierOrder(courierRow.provider, courierCredentials, order);

  // Persist the provider consignment before attempting store sync. If the store
  // API is temporarily unavailable, the next worker pass only retries the sync.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE public.orders
       SET courier_provider = $2, courier_consignment_id = $3,
           courier_tracking_code = $4, courier_booked_at = NOW(),
           delivery_status = 'booked',
           store_tracking_synced = ($5::text IS NULL),
           store_sync_error = NULL
       WHERE id = $1 AND courier_consignment_id IS NULL`,
      [order.id, courierRow.provider, booking.consignmentId, booking.trackingCode, order.store_provider || null],
    );
    await client.query(
      `INSERT INTO public.courier_orders
        (merchant_id, order_id, order_code, courier_name, tracking_code, consignment_id,
         recipient_name, recipient_phone, status, metadata, booking_response)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Booked',$9::jsonb,$10::jsonb)`,
      [job.merchant_id, order.id, String(order.platform_order_id), courierRow.provider,
        booking.trackingCode, booking.consignmentId, order.customer_name, order.customer_phone,
        JSON.stringify({ storeSync: order.store_provider ? 'pending' : 'not_required' }), JSON.stringify(booking.raw || {})],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  if (!order.store_provider) {
    await completeJob(pool, job.id, 'completed', null, false, job.attempts);
    return;
  }
  const storeRow = byProvider.get(order.store_provider);
  await processStoreTrackingSync(pool, job, {
    ...order,
    courier_provider: courierRow.provider,
    courier_consignment_id: booking.consignmentId,
    courier_tracking_code: booking.trackingCode,
  }, storeRow);
}

export function startCourierFulfillmentWorker({ pool, logger = console, intervalMs = 10000 } = {}) {
  if (!pool?.query) return () => {};
  let stopped = false;
  let running = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const job = await claimNext(pool);
      if (job) {
        try {
          await processJob(pool, job);
        } catch (error) {
          logger.error?.('[KashNode Courier] Fulfillment attempt failed.', { jobId: job.id, message: safeError(error) });
          const retry = job.attempts < 8;
          await completeJob(pool, job.id, retry ? 'failed' : 'blocked', safeError(error), retry, job.attempts);
        }
      }
    } catch (error) {
      logger.error?.('[KashNode Courier] Worker tick failed.', { message: safeError(error) });
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, Math.max(3000, intervalMs));
  timer.unref?.();
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
