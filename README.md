# KashNode

Mobile-first AI payment and e-commerce operations dashboard built with React, TypeScript, Vite, and Tailwind CSS v4.

## Start locally

```bash
npm install
npm run start
```

In another terminal, run the frontend:

```bash
npm run dev
```

Copy `.env.example` to `.env` before configuring secrets. The API binds to `127.0.0.1:4892`; Vite runs on `http://localhost:5173`. Keep the API loopback-bound for local-only access. A remote KashNode Box cannot reach a loopback address; remote device deployments need a private tunnel or an authenticated HTTPS reverse proxy and an appropriately configured origin.

## Backend configuration

- Set `SESSION_SECRET` to a cryptographically random secret (at least 32 bytes), `KASHNODE_ADMIN_EMAIL`, and a bcrypt hash in `KASHNODE_ADMIN_PASSWORD_HASH`. The API has no default password.
- Set a random `KASHNODE_DEVICE_TOKEN` (at least 32 bytes). The hardware box sends it as `Authorization: Bearer <token>`. Set `KASHNODE_DEVICE_ID` to restrict writes to one registered device.
- `DATABASE_URL` enables persistent PostgreSQL sessions, SIM status, call history, and USSD settings. The API creates its `kashnode_*` tables automatically. For Supabase use its database connection string and keep TLS certificate verification enabled.
- `FRONTEND_ORIGIN` must exactly match the browser origin. Credentialed CORS does not accept wildcard origins. Production cookies are `Secure`, `HttpOnly`, and `SameSite=Lax`.
- For device status, send `deviceId`, numeric `balance`, `internetDataMb`, `signalStrength` (0–5), and optionally `dataQuotaMb`, `networkType`, and `online`.

Courier tracking currently returns an explicitly marked demo response until Steadfast/RedX/Pathao credentials and provider API adapters are configured. Call history reads PostgreSQL records when configured; without a database the API serves clearly marked demo calls with no audio recordings.

## Build

```bash
npm run build
npm run preview
```

## Login API contract

Configure `VITE_API_BASE_URL` for your backend. The UI calls:

- `POST /api/auth/login` with `{ "email", "password" }`
- `GET /api/auth/session` to restore a session
- `POST /api/auth/logout` to end a session

The Express backend now validates credentials, rotates the session on login, uses an HttpOnly session cookie, checks origins for state-changing browser requests, and restricts credentialed CORS to the configured app origin. The browser does not save access tokens in local storage or session storage.

## UI modules

- Dashboard: verified payment volume, AI calls, wallet, device health, activity chart, recent updates.
- AI Controls: payment verification, COD OTP, AI voice toggles and live call monitoring actions.
- History: payment logbook, manual approval UI, AI call summaries and recording controls.
- Settings: voice profile, knowledge base guidance, and courier selection.

Live calls, recharge, and AI workflow toggles remain UI integration points until their provider services are connected. SIM status and USSD settings are connected to API routes.


## AI order voice prompt service

`server/services/aiPromptService.js` generates a single TTS-ready phone script from an order already stored in PostgreSQL/Supabase. It supports OpenAI (default), Gemini and Groq; the provider is selected per invocation so a Super Admin workflow can switch engines without restarting the server.

```js
import { generateOrderVoiceScript } from './server/services/aiPromptService.js'

const result = await generateOrderVoiceScript({
  pool,
  orderId: savedOrderId, // public.orders.id (UUID)
  provider: 'openai',    // 'openai' | 'gemini' | 'groq'
  language: 'bn-BD',
})

if (result.ok) {
  // OpenAI TTS: result.tts.openai.input
  // Deepgram TTS: result.tts.deepgram.text
} else {
  // result.error.code / result.error.message
}
```

Configure one or more server-side API keys: `OPENAI_API_KEY`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`), and `GROQ_API_KEY`. Optional model overrides: `OPENAI_MODEL`, `GEMINI_MODEL`, and `GROQ_MODEL`.

The service loads `customer_phone`, `payment_method`, `payment_status`, `total_amount`, `currency`, and `line_items` from `public.orders`. It validates the phone locally and does not send the phone number to the LLM. COD always asks for order confirmation. A payment-received script is generated only when the database payment status is `paid`; unpaid and review states never claim payment was received. Apply `db/migrations/20261105114500_add_order_currency_for_ai_voice.sql` before enabling this service.
