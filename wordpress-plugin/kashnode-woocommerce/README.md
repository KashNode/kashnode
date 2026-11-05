# KashNode WooCommerce Connector

A lightweight WordPress plugin that forwards checkout orders to the KashNode Express webhook receiver.

## Install

1. Zip the `kashnode-woocommerce` directory.
2. In WordPress, open **Plugins → Add New → Upload Plugin**, upload the ZIP, and activate it.
3. Open **WooCommerce → KashNode**.
4. Enter the KashNode HTTPS endpoint (for example, `https://your-kashnode-host/api/webhooks/woocommerce`).
5. Paste the merchant's existing KashNode `webhook_secret` into **Secret Key** and save.

The secret field is intentionally blank after saving. Leave it blank to keep the current secret; it is not rendered back into the admin page.

## What it sends

When an order is processed in classic checkout or WooCommerce Checkout Block, the plugin sends the order ID, billing name and phone, total, payment method, and sanitized line items as JSON.

The request contains:

- `X-KashNode-Webhook-Secret`: merchant's shared webhook secret.
- `X-WC-Webhook-Signature`: base64-encoded HMAC-SHA256 of the exact JSON request body, signed with that secret.

The receiver verifies both headers over HTTPS, resolves the merchant from the saved secret, and handles retries idempotently.

## Backend setup

Apply `db/migrations/20261105103000_add_woocommerce_order_webhook_fields.sql` to the KashNode Supabase/Postgres database before enabling the plugin. The migration safely adds order metadata, phone verification and AI call state columns, then adds a merchant-scoped unique order index after checking legacy rows.

Do not put the merchant secret in a URL, query string, JavaScript, or public frontend.
