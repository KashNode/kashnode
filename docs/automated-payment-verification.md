# Automated merchant billing verification

## Merchant flow

1. The merchant chooses `android_app` (default) or `kashnode_box` during onboarding.
2. The merchant requests a six-digit OTP for their primary MFS billing phone. OTPs expire after five minutes, are HMAC-hashed at rest, and are limited to six attempts.
3. The merchant verifies the OTP. The server binds the number to `merchants.billing_phone` and sets `is_billing_phone_verified`.
4. A top-up request supplies `gateway`, `trx_id`, and `amount`. The server ignores any submitted sender number and uses the verified billing phone.
5. The admin payment-collection device posts a normalized incoming transfer event. The processor requires the configured platform receiver number and matches gateway, TrxID, amount, and sender phone.
6. The top-up status and wallet credit are committed in one PostgreSQL transaction. Unique gateway/TrxID constraints prevent replay and duplicate credit. The processor reconciles both arrival orders (SMS first or top-up first).

## Endpoints

- `POST /api/merchant/billing-phone/otp` — JSON `{ "phone": "017..." }`
- `POST /api/merchant/billing-phone/verify` — JSON `{ "code": "123456" }`
- `POST /api/merchant/topup` — JSON `{ "gateway": "bKash", "trx_id": "...", "amount": 500 }`
- `POST /api/admin/device/payment-sms` — Bearer device token plus JSON `{ "gateway", "trx_id", "amount", "sender_phone", "receiver_phone", "received_at", "device_id", "message" }`

Merchant endpoints use the authenticated merchant session. The device endpoint requires `KASHNODE_DEVICE_TOKEN` and, when configured, exact `KASHNODE_DEVICE_ID`.

## Required server configuration

- `BILLING_PHONE_OTP_SECRET` (or existing `AUTH_OTP_SECRET`): high-entropy secret used to HMAC OTP codes.
- `KASHNODE_SMS_GATEWAY_URL` and `KASHNODE_SMS_GATEWAY_API_KEY`: platform SMS provider endpoint and bearer credential. The adapter sends JSON `{ "to", "message" }`; map this contract to the chosen provider.
- `KASHNODE_MFS_RECEIVER_BKASH`, `KASHNODE_MFS_RECEIVER_NAGAD`, `KASHNODE_MFS_RECEIVER_ROCKET`, `KASHNODE_MFS_RECEIVER_UPAY`: the platform's receiving numbers. Events with a different receiver are ignored.
- Existing `KASHNODE_DEVICE_TOKEN` and `KASHNODE_DEVICE_ID` secure the admin collection device.

Apply `db/migrations/202611060001_merchant_billing_verification.sql` before deploying the API.

## Processor boundary and trust model

`SmsMatchingPaymentProcessor` is the initial adapter. An official bKash Merchant API or SSLCommerz adapter should implement the same normalized verified-transfer boundary and invoke the same atomic reconciliation/credit service. Do not treat merchant-entered TrxID data as proof of payment.

The initial SMS flow is evidence from a trusted device, not a provider-authoritative webhook. The admin device must only forward notifications from the official MFS app/SMS inbox and must preserve original receipt time and raw message for audit. Per-device signed payloads and provider-specific parsing should be added when the Android collector source is integrated; this repository change does not implement or claim an Android collector app.
