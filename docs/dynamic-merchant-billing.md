# Dynamic merchant billing configuration

Pricing is sourced from `public.subscription_plans`. Merchant-facing plan and wallet screens read the catalog and active merchant plan from authenticated API endpoints; no browser-supplied price is trusted for wallet top-ups.

## Database migrations

Apply these migrations in order after the existing schema migrations:

- `20261107120000_dynamic_merchant_billing_and_plan_upgrades.sql`
- `20261107130000_use_database_plan_rates_for_voice_billing.sql`

The plan catalog adds `monthly_fee`, `included_minutes`, `price_per_minute`, and `minimum_topup_minutes`. The minimum has a database baseline; all other plan pricing is editable configuration.

## Super Admin configuration endpoints

- `GET /api/admin/plans` — list every plan and its pricing fields.
- `PUT /api/admin/plans/:slug` — update `name`, `monthly_fee`, `included_minutes`, `price_per_minute`, `minimum_topup_minutes`, and `is_active`.
- `GET /api/admin/mfs-destinations` — list official payment destinations.
- `PUT /api/admin/mfs-destinations` — replace the active destination set using `{ destinations: [{ provider, account_label, phone_number, is_active, display_order }] }`.

These endpoints require a Super Admin session and same-origin write requests. Populate the official bKash, Nagad, and Rocket destination numbers before accepting manual upgrade requests. No payment destination is seeded or guessed by this feature.

## Merchant endpoints

- `GET /api/merchant/package` — active plan and effective database rate.
- `GET /api/merchant/billing-config` — active plans, current plan and configured payment destinations.
- `POST /api/merchant/wallet/topup` — submit `gateway`, `trx_id`, `minutes`, and sender phone. The server locks and reads the active plan, checks the configured minimum, and calculates the amount from `price_per_minute`; it ignores any client-calculated amount.
- `POST /api/merchant/plan-upgrade` — submit `plan_slug`, `sender_phone`, `gateway`, and `trx_id`. The request is stored as `pending_review`; it does not activate the new plan.

Plan activation remains an explicit admin verification action. The manual request endpoint does not imply that payment has been received or verified.


## Automated MFS reconciliation and device security

Apply `20261107140000_mfs_upgrade_reconciliation_security.sql` after the two billing migrations. It adds the upgrade amount snapshot, payment-event link, and replay nonce registry. Historical upgrade requests retain a NULL amount snapshot and are intentionally not eligible for automatic approval.

New plan-upgrade requests snapshot `subscription_plans.monthly_fee` as `expected_amount`. The shared SMS processor matches wallet top-ups and plan upgrades using gateway, TrxID, exact amount, and normalized sender phone. A matched upgrade is approved and `merchants.subscription_plan` is updated in the same database transaction. Wallet top-up reconciliation remains on its existing transactional credit path.

Receiver validation now uses the active `mfs_payment_destinations` rows as the canonical destination registry. Both stored destinations and device-supplied receiver numbers are normalized to Bangladesh local format before comparison.

### Device request signing

Production must set:
- `KASHNODE_DEVICE_TOKEN` (existing bearer credential, at least 32 bytes)
- `KASHNODE_DEVICE_HMAC_SECRET` (new signing secret, at least 32 bytes)
- `KASHNODE_DEVICE_ID` (expected device ID)

The device signs the exact UTF-8 request body with HMAC-SHA256 over `timestamp.nonce.rawBody`. It sends `X-KashNode-Timestamp`, `X-KashNode-Nonce`, and `X-KashNode-Signature`. The API enforces a five-minute timestamp window and stores each nonce in `mfs_device_nonces`; duplicate nonces are rejected. Configure the Android app from `android/mfs-gateway/README.md`.

**Deployment order:** apply the new SQL migration, configure the HMAC secret in the server environment, rebuild/restart the API, provision the dedicated Android device with the matching token and secret, then test with redacted real SMS examples. The device endpoint fails closed when signing is not configured.
