# Merchant Dashboard & Backend SSOT Audit

**Repository:** `KashNode/kashnode`  
**Baseline:** `main` at `3fc637ccffc5af6894f4ee12ea792738b686387a`  
**Audit branch:** `chore/merchant-dashboard-ssot-audit`

## Scope and repository structure

The recursive Git tree contained 219 tracked files at the audit baseline. The current merchant dashboard is not split into `src/pages/Settings.tsx` and `src/pages/Integrations.tsx`: dashboard routes and page composition live in `src/pages/AppShell.tsx`, while merchant integration cards/forms live in `src/components/MerchantIntegrationsSettings.tsx`. `src/pages/site/IntegrationsPage.tsx` is the public marketing page and is not a second merchant integration settings screen.

The runtime files inspected for this change were the dashboard shell, integration settings component, app route declarations, API client, merchant onboarding/dashboard/integration route modules, Shopify and WooCommerce webhook handlers, and Express route mounting. This is a source-based audit, not a claim that every visual state or every production database behavior has been exhaustively exercised.

## 1. Audit inventory matrix

| File Location | Duplicate Element | Where else it appears | Resolution |
|---|---|---|---|
| `src/pages/AppShell.tsx` (home, Box, Settings > Workspace profile, Settings > Security & API) | Same merchant device ID/secret card was mounted four times | The other three dashboard sections | **Consolidate:** retain the single canonical card in Settings > Security & API; remove the home, Box, and Workspace-profile copies |
| `src/pages/AppShell.tsx` (Settings > Security & API) | `MerchantIntegrationsSettings section="webhooks"` re-rendered the same provider cards/forms from Integrations | Dashboard > Integrations (couriers/stores/webhooks) | **Relocate:** replace the duplicate form set with a link to Dashboard > Integrations > Webhooks |
| `src/components/MerchantIntegrationsSettings.tsx` | Shopify form reset wrote the stale `webhookSecret` property although the canonical field is `admin_webhook_secret` | `initialForms.shopify` and the Shopify input use `admin_webhook_secret` | **Consolidate:** clear the canonical field and remove the stale property |
| `src/pages/AppShell.tsx` | Header and dashboard shell are composed in one place; Sidebar is mounted in desktop and mobile variants | No second dashboard header/sidebar wrapper was found in the merchant page composition | **Keep:** responsive Sidebar variants are intentional; do not create a second chrome system |
| `src/App.tsx` and `src/pages/AppShell.tsx` | Onboarding profile is read once for route gating and again by the dashboard for profile/billing display | `getMerchantOnboarding()` in each lifecycle | **Retain for now:** the first read gates access before dashboard mount; the second supplies the dashboard profile payload. A shared authenticated data provider/query cache is a larger architectural change and needs cache invalidation design |
| `src/pages/AppShell.tsx` and `src/components/MerchantIntegrationsSettings.tsx` | Shopify sync is actionable from Orders and from the connected Shopify card | Both invoke `POST /api/merchant/integrations/shopify/sync` | **Keep as contextual actions:** they share one backend operation; the Orders action refreshes the visible order list while the integration action is a convenient integration-level trigger |
| `server.js` | Shopify webhook receiver could be duplicated if mounted in more than one router | Checked all current Express mount declarations | **Keep:** exactly one `POST /api/webhooks/shopify` mount exists, before global JSON parsing, with dedicated `express.raw()` |
| `server/routes/merchantIntegrations.js` | Potential overlap between Shopify connection and generic provider test/save endpoints | `connectShopify` vs `:provider/test` and `:provider` | **Keep distinct:** generic test/save explicitly reject Shopify; Shopify uses its dedicated client-credentials connection handler |
| `server.js` and `server/routes/woocommerceWebhook.js` | Two WooCommerce webhook URL shapes | `POST /api/webhooks/woocommerce` and legacy `POST /api/v1/webhooks/woocommerce/:merchantId` | **Keep compatibility route:** source comments explicitly preserve existing installations; deleting it without a migration window would be a breaking API change |
| `server/routes/merchant.js` and `server/routes/merchantIntegrations.js` | Merchant ownership verification before resource reads | Profile/onboarding and integration endpoints query merchant ownership in their own request handlers | **Keep scoped checks:** these are separate request boundaries and protect tenant data; no safe shared query can be substituted without changing response/ownership contracts |
| `src/pages/site/IntegrationsPage.tsx` | Page name resembles merchant Integrations | `src/pages/AppShell.tsx` dashboard route | **Keep distinct:** one is public product/marketing content; the other is authenticated merchant configuration |

## 2. Remediation applied

1. Removed three repeated device/API credential-card placements from the dashboard home, Box, and Workspace profile views. The card remains in Settings > Security & API as its canonical management location.
2. Removed the second provider-card/form set from Settings > Security & API. That section now points merchants to Dashboard > Integrations > Webhooks, where provider credentials and webhook configuration are managed.
3. Corrected the Shopify form reset to clear `admin_webhook_secret`, not the obsolete `webhookSecret` state property.

## 3. Backend route and middleware findings

- Shopify webhook: one explicit mount at `POST /api/webhooks/shopify`; raw JSON bytes are captured before `express.json()`. The route wrapper forwards rejected promises to Express error handling. No duplicate Shopify fallback mount was found.
- Shopify OAuth callback routes: no Shopify `/auth` or `/callback` route is mounted in the current `server.js` route table. Shopify connection is handled by `POST /api/merchant/integrations/shopify/connect`.
- Manual Shopify sync and webhook ingestion are separate delivery paths (merchant-initiated pull vs Shopify push) and converge on the same orders table; they are not duplicate endpoints.
- `GET /api/merchant/orders` is the DB-backed read endpoint; the sync endpoint returns a refreshed DB-backed order list after importing.
- WooCommerce legacy webhook URL is intentionally retained for compatibility. It is not safe to remove based only on the presence of the newer URL.
- No separate merchant `/api/integrations/*` router family or duplicate Shopify webhook router mount was found in the route registration inspected.

## 4. Remaining architecture observations (not silently changed)

- There is no React Query dependency or central merchant integration context in the current package manifest. Integration status is loaded by the integration settings component; introducing a cache/provider would require defining freshness, mutation invalidation, and session teardown behavior.
- `App.tsx` performs onboarding lookup for access control; `AppShell.tsx` performs a separate lookup to obtain profile fields. They have different lifecycle responsibilities today. A future shared session/bootstrap context could eliminate the repeat request safely.
- `AppShell.tsx` currently loads several dashboard resources on initial mount, even when their view is not active. Lazy per-view loading or a cache is a performance opportunity, not a duplicate UI/state conflict proven by this pass.
- Duplicate labels such as “Test Connection”, “Sync Orders”, and “Save & Connect” are reused as consistent action labels in a single provider-card implementation; they are not separate competing copies of the form.

## 5. Verification

The repository defines:
- `npm test` — `node --test tests/*.test.js`
- `npm run build` — TypeScript project build followed by Vite production build

These checks must pass on the audit branch's GitHub Actions run before merge. No production deployment or merge is part of this change.
