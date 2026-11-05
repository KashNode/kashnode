import 'dotenv/config'
import { createServer } from 'node:http'
import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import bcrypt from 'bcryptjs'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pg from 'pg'
import connectPgSimple from 'connect-pg-simple'
import path from 'node:path'
import { createEdgeSmsHandler } from './server/routes/edgeSms.js'
import { createWooCommerceWebhookHandler } from './server/routes/woocommerceWebhook.js'
import { createShopifyWebhookHandler } from './server/routes/shopifyWebhook.js'
import { createMerchantOnboardingHandlers } from './server/routes/merchant.js'
import { createAdminSettingsHandlers } from './server/routes/adminSettings.js'
import { reconcilePendingSmsForMerchant, reconcileSms } from './server/services/reconcileService.js'
import { createAllowedOrigins, isAllowedOrigin } from './server/utils/origins.js'
import { createAuthController } from './server/controllers/authController.js'
import { isDisposableEmail } from './server/services/disposableEmail.js'
import { sendSignupOtpEmail } from './server/services/emailService.js'
import { verifyGoogleIdToken } from './server/services/googleIdToken.js'
import { createVoiceStreamingService } from './server/services/voiceStreamingService.js'

const { Pool } = pg
const app = express()
const PORT = Number(process.env.PORT || 4892)
const HOST = '0.0.0.0'
const NODE_ENV = process.env.NODE_ENV || 'development'
const IS_PRODUCTION = NODE_ENV === 'production'
const ALLOWED_ORIGINS = createAllowedOrigins(process.env)
const SESSION_SECRET = process.env.SESSION_SECRET || ''
const ADMIN_EMAIL = (process.env.KASHNODE_ADMIN_EMAIL || '').trim().toLowerCase()
const ADMIN_PASSWORD_HASH = process.env.KASHNODE_ADMIN_PASSWORD_HASH || ''
const DEVICE_TOKEN = process.env.KASHNODE_DEVICE_TOKEN || ''
const DEVICE_ID = process.env.KASHNODE_DEVICE_ID || ''
const DATA_QUOTA_MB = Number(process.env.SIM_DATA_QUOTA_MB || 10240)
const COOKIE_NAME = IS_PRODUCTION ? '__Host-kashnode.sid' : 'kashnode.sid'

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be a valid TCP port.')
if (!Number.isFinite(DATA_QUOTA_MB) || DATA_QUOTA_MB <= 0) throw new Error('SIM_DATA_QUOTA_MB must be greater than zero.')
if (IS_PRODUCTION) {
  if (!SESSION_SECRET || Buffer.byteLength(SESSION_SECRET) < 32) throw new Error('Production requires a SESSION_SECRET of at least 32 bytes.')
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) throw new Error('Production requires KASHNODE_ADMIN_EMAIL and KASHNODE_ADMIN_PASSWORD_HASH.')
  if (!DEVICE_TOKEN || Buffer.byteLength(DEVICE_TOKEN) < 32) throw new Error('Production requires a KASHNODE_DEVICE_TOKEN of at least 32 bytes.')
  if (!process.env.DATABASE_URL) throw new Error('Production requires DATABASE_URL for persistent sessions and application data.')
} else if (!SESSION_SECRET) {
  console.warn('[KashNode] SESSION_SECRET is missing; login is disabled until configured.')
}

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : undefined, options: '-c statement_timeout=10000' })
  : null
const httpServer = createServer(app)
const voiceStreamingService = createVoiceStreamingService({ pool })
voiceStreamingService.attach(httpServer)

app.disable('x-powered-by')
app.set('trust proxy', IS_PRODUCTION ? 1 : false)
app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))
app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin, ALLOWED_ORIGINS)) return callback(null, true)
    return callback(new Error('Origin is not allowed by CORS.'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-merchant-secret', 'x-kashnode-webhook-secret', 'x-wc-webhook-signature', 'x-shopify-hmac-sha256', 'x-shopify-shop-domain', 'x-shopify-topic'],
  maxAge: 600,
}))
// Shopify must receive the exact request bytes for HMAC verification. Mount
// this route before express.json so the global parser cannot consume the body.
app.post('/api/webhooks/shopify', express.raw({ type: 'application/json', limit: '1mb' }), (req, res, next) => {
  Promise.resolve(createShopifyWebhookHandler({
    pool,
    onOrderPersist: merchantId => reconcilePendingSmsForMerchant({ pool, merchantId }),
  })(req, res)).catch(next)
})
app.use(express.json({ limit: '1mb', strict: true, verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer) } }))
app.use(cookieParser())

const sessionOptions = {
  name: COOKIE_NAME,
  secret: SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 },
}
if (pool) {
  const PgSession = connectPgSimple(session)
  sessionOptions.store = new PgSession({ pool, tableName: 'kashnode_sessions', createTableIfMissing: true, ttl: 30 * 24 * 60 * 60 })
} else if (IS_PRODUCTION) {
  throw new Error('Production session storage must be persistent.')
} else {
  console.warn('[KashNode] DATABASE_URL missing; sessions use in-memory storage (development only).')
}
app.use(session(sessionOptions))

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

function requireOrigin(req, res, next) {
  const origin = req.get('origin')
  if (isAllowedOrigin(origin, ALLOWED_ORIGINS, { allowMissing: !IS_PRODUCTION })) return next()
  return res.status(403).json({ status: 'error', message: 'Request origin is not allowed.' })
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.id && req.session.user.role === 'admin') return next()
  return res.status(401).json({ status: 'error', message: 'Authentication required.' })
}

function requireMerchantSession(req, res, next) {
  const user = req.session?.user
  if (!user?.id || !user?.merchantId || user.role === 'admin') {
    return res.status(401).json({ status: 'error', message: 'Merchant authentication required.' })
  }
  return next()
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function safeRecordingUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' ? parsed.toString() : null
  } catch { return null }
}

function requireDevice(req, res, next) {
  const auth = req.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!DEVICE_TOKEN || !safeEqual(token, DEVICE_TOKEN)) return res.status(401).json({ status: 'error', message: 'Invalid device credentials.' })
  next()
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { status: 'error', message: 'Too many sign-in attempts. Try again later.' } })
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { status: 'error', message: 'Too many account creation attempts. Try again later.' } })
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { status: 'error', message: 'Too many verification attempts. Try again later.' } })
const googleLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { status: 'error', message: 'Too many Google sign-in attempts. Try again later.' } })

async function createUserSession(req, user) {
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()))
  req.session.user = user
  await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()))
}

const authController = createAuthController({
  pool,
  createUserSession,
  sendOtpEmail: sendSignupOtpEmail,
  checkDisposableEmail: isDisposableEmail,
  verifyGoogleCredential: credential => verifyGoogleIdToken(credential, { clientId: process.env.GOOGLE_CLIENT_ID }),
  otpSecret: process.env.AUTH_OTP_SECRET || '',
})
const merchantOnboardingHandlers = createMerchantOnboardingHandlers({ pool })
const adminSettingsHandlers = createAdminSettingsHandlers({ pool })

app.get('/api/health', (_req, res) => res.json({ status: 'success', service: 'KashNode API', timestamp: new Date().toISOString() }))

// Merchant ownership is resolved from the signed server session, never from request body input.
app.get('/api/merchant/onboarding', requireMerchantSession, asyncRoute(merchantOnboardingHandlers.getOnboarding))
app.post('/api/merchant/onboarding', requireOrigin, requireMerchantSession, asyncRoute(merchantOnboardingHandlers.postOnboarding))
// Reveal integration credentials only to the merchant owner after onboarding is complete.
app.get('/api/merchant/credentials', requireMerchantSession, asyncRoute(merchantOnboardingHandlers.getCredentials))

// Super Admin-only platform settings. Provider key material is written to Vault server-side.
app.get('/api/admin/settings', requireAdmin, asyncRoute(adminSettingsHandlers.getSettings))
app.post('/api/admin/settings', requireOrigin, requireAdmin, asyncRoute(adminSettingsHandlers.postSettings))

app.post('/api/v1/edge/sms', asyncRoute(createEdgeSmsHandler({
  pool,
  onPersist: smsId => reconcileSms({ pool, smsId }),
})))
// WordPress plugin integration: resolve the merchant by its private shared secret header.
app.post('/api/webhooks/woocommerce', asyncRoute(createWooCommerceWebhookHandler({
  pool,
  onOrderPersist: merchantId => reconcilePendingSmsForMerchant({ pool, merchantId }),
})))
// Legacy WooCommerce webhook URL remains supported for existing installations.
app.post('/api/v1/webhooks/woocommerce/:merchantId', asyncRoute(createWooCommerceWebhookHandler({
  pool,
  onOrderPersist: merchantId => reconcilePendingSmsForMerchant({ pool, merchantId }),
})))

app.post('/api/auth/login', requireOrigin, loginLimiter, asyncRoute(async (req, res) => {
  if (!SESSION_SECRET) return res.status(503).json({ status: 'error', message: 'Authentication is not configured on this server.' })
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!email || !password || email.length > 254 || password.length > 1024) return res.status(400).json({ status: 'error', message: 'Email and password are required.' })
  if (!pool) return res.status(503).json({ status: 'error', message: 'Authentication database is unavailable.' })
  let user = null
  const found = await pool.query(`SELECT u.id, u.email, u.name, u.role, u.password_hash, m.id AS merchant_id
    FROM public.users u LEFT JOIN public.merchants m ON m.owner_user_id = u.id
    WHERE lower(u.email) = lower($1) LIMIT 1`, [email])
  if (found.rows[0]?.password_hash && await bcrypt.compare(password, found.rows[0].password_hash).catch(() => false)) {
    user = { id: String(found.rows[0].id), email: found.rows[0].email, name: found.rows[0].name || found.rows[0].email, role: found.rows[0].role, ...(found.rows[0].merchant_id ? { merchantId: String(found.rows[0].merchant_id) } : {}) }
  }
  if (!user) return res.status(401).json({ status: 'error', message: 'Invalid email or password.' })
  await createUserSession(req, user)
  if (req.body?.rememberMe === true) req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000
  if (req.body?.rememberMe === true) await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()))
  res.json({ status: 'success', user: req.session.user })
}))

app.post('/api/auth/signup', requireOrigin, registerLimiter, asyncRoute(authController.signup))
// Retain the previous frontend endpoint, but route it through the same OTP flow.
// This prevents legacy clients from bypassing email verification.
app.post('/api/auth/register', requireOrigin, registerLimiter, asyncRoute(authController.signup))
app.post('/api/auth/verify-otp', requireOrigin, otpLimiter, asyncRoute(authController.verifyOtp))
app.post('/api/auth/google/nonce', requireOrigin, googleLimiter, asyncRoute(async (req, res) => {
  if (!SESSION_SECRET) return res.status(503).json({ status: 'error', message: 'Authentication is not configured on this server.' })
  req.session.googleNonce = crypto.randomBytes(32).toString('base64url')
  await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()))
  res.json({ status: 'success', nonce: req.session.googleNonce })
}))
app.post('/api/auth/google', requireOrigin, googleLimiter, asyncRoute(authController.google))

app.get('/api/auth/session', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ status: 'error', message: 'No active session.' })
  res.json({ user: req.session.user })
})

app.post('/api/auth/logout', requireOrigin, (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error)
    res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax', path: '/' })
    res.status(204).end()
  })
})

app.get('/api/device/sim-status', requireAdmin, asyncRoute(async (_req, res) => {
  const result = await pool.query('SELECT device_id, balance_bdt, data_mb, signal_strength, raw_payload, created_at FROM device_logs ORDER BY created_at DESC LIMIT 1')
  const status = result.rows[0]
  const payload = status?.raw_payload || {}
  res.json({
    deviceId: status?.device_id ?? 'No device report',
    balance: Number(status?.balance_bdt ?? 0),
    internetDataMb: Number(status?.data_mb ?? 0),
    dataQuotaMb: Number(payload.dataQuotaMb ?? DATA_QUOTA_MB),
    signalStrength: Number(status?.signal_strength ?? 0),
    networkType: payload.networkType ?? 'Unknown',
    online: Boolean(status && payload.online !== false),
    updatedAt: status?.created_at ?? null,
    source: 'database',
  })
}))

app.get('/api/settings/sim-ussd', requireAdmin, asyncRoute(async (_req, res) => {
  const result = await pool.query('SELECT auto_balance, frequency, balance_code, data_code FROM ussd_settings ORDER BY updated_at DESC LIMIT 1')
  const row = result.rows[0]
  res.json(row ? { autoBalance: row.auto_balance, frequency: row.frequency, balanceCode: row.balance_code, internetCode: row.data_code, source: 'database' } : { autoBalance: true, frequency: 'Every 6 hours', balanceCode: '*566#', internetCode: '*5000#', source: 'database' })
}))

app.put('/api/settings/sim-ussd', requireOrigin, requireAdmin, asyncRoute(async (req, res) => {
  const { autoBalance, frequency, balanceCode, internetCode } = req.body || {}
  const frequencies = new Set(['Every 6 hours', 'Daily', 'Manual'])
  const isUssd = value => typeof value === 'string' && value.length <= 32 && /^\*[0-9*#]{1,30}#$/.test(value)
  if (typeof autoBalance !== 'boolean' || !frequencies.has(frequency) || !isUssd(balanceCode) || !isUssd(internetCode)) {
    return res.status(400).json({ status: 'error', message: 'Provide valid automation, frequency, and USSD code settings.' })
  }
  await pool.query(`INSERT INTO ussd_settings (id, auto_balance, frequency, balance_code, data_code, updated_at)
    VALUES (1,$1,$2,$3,$4,NOW()) ON CONFLICT (id) DO UPDATE SET auto_balance=EXCLUDED.auto_balance, frequency=EXCLUDED.frequency, balance_code=EXCLUDED.balance_code, data_code=EXCLUDED.data_code, updated_at=NOW()`,
  [autoBalance, frequency, balanceCode, internetCode])
  res.json({ status: 'success', settings: { autoBalance, frequency, balanceCode, internetCode, source: 'database' } })
}))

app.post('/api/device/sim-status', requireDevice, asyncRoute(async (req, res) => {
  const { deviceId, balance, internetDataMb, signalStrength } = req.body || {}
  const networkType = typeof req.body?.networkType === 'string' ? req.body.networkType.trim().slice(0, 24) : '4G LTE'
  const online = req.body?.online !== false
  const quota = req.body?.dataQuotaMb === undefined ? DATA_QUOTA_MB : Number(req.body.dataQuotaMb)
  if (typeof deviceId !== 'string' || !deviceId.trim() || deviceId.length > 128) return res.status(400).json({ status: 'error', message: 'A valid deviceId is required.' })
  if (DEVICE_ID && !safeEqual(deviceId.trim(), DEVICE_ID)) return res.status(403).json({ status: 'error', message: 'This device is not registered.' })
  const values = [balance, internetDataMb, signalStrength, quota].map(Number)
  if (values.some(value => !Number.isFinite(value)) || values[0] < 0 || values[1] < 0 || values[2] < 0 || values[2] > 5 || values[3] <= 0) {
    return res.status(400).json({ status: 'error', message: 'Expected balance >= 0, internetDataMb >= 0, dataQuotaMb > 0, and signalStrength between 0 and 5.' })
  }
  const rawPayload = { ...req.body, deviceId: deviceId.trim(), dataQuotaMb: values[3], networkType, online }
  const result = await pool.query('INSERT INTO device_logs (device_id, balance_bdt, data_mb, signal_strength, raw_payload) VALUES ($1,$2,$3,$4,$5) RETURNING created_at',
    [deviceId.trim(), values[0], values[1], values[2], rawPayload])
  const createdAt = result.rows[0].created_at
  console.info(`[KashNode Box Sync] ${deviceId.trim()} · signal ${values[2]}/5 · ${online ? 'online' : 'offline'}`)
  res.status(202).json({ status: 'success', message: 'SIM status synced successfully.', updatedAt: createdAt })
}))

app.get('/api/orders/track/:orderId', requireAdmin, asyncRoute(async (req, res) => {
  const orderId = req.params.orderId.trim()
  const courier = String(req.query.courier || 'steadfast').toLowerCase()
  const names = { steadfast: 'Steadfast', redx: 'RedX', pathao: 'Pathao' }
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(orderId)) return res.status(400).json({ status: 'error', message: 'Order ID format is invalid.' })
  if (!names[courier]) return res.status(400).json({ status: 'error', message: 'Courier must be steadfast, redx, or pathao.' })
  const result = await pool.query(`SELECT order_code, courier_name, tracking_code, status, delivery_charge, created_at
    FROM courier_orders WHERE lower(courier_name) = lower($1) AND (order_code = $2 OR tracking_code = $2)
    ORDER BY created_at DESC LIMIT 1`, [names[courier], orderId])
  const order = result.rows[0]
  if (!order) return res.status(404).json({ status: 'error', message: 'No matching courier order was found.' })
  res.json({ orderId: order.order_code, courier: order.courier_name, trackingCode: order.tracking_code, status: order.status, deliveryCharge: order.delivery_charge == null ? null : Number(order.delivery_charge), note: null, source: 'database', checkedAt: order.created_at })
}))

app.get('/api/calls/history', requireAdmin, asyncRoute(async (_req, res) => {
  const result = await pool.query(`SELECT id, phone_number, created_at, duration, status, ai_summary, recording_url FROM ai_calls ORDER BY created_at DESC LIMIT 100`)
  res.json({ source: 'database', calls: result.rows.map(row => ({ id: String(row.id), phone: row.phone_number, occurredAt: row.created_at, durationSeconds: Number(row.duration || 0), status: row.status, summary: row.ai_summary || '', recordingUrl: safeRecordingUrl(row.recording_url) })) })
}))

const distDir = path.resolve('dist')
app.use(express.static(distDir))
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
  res.sendFile(path.join(distDir, 'index.html'), error => { if (error) next(error) })
})

app.use((error, _req, res, _next) => {
  console.error('[KashNode API]', error)
  if (res.headersSent) return
  const status = error.message === 'Origin is not allowed by CORS.' ? 403 : 500
  res.status(status).json({ status: 'error', message: status === 403 ? 'Request origin is not allowed.' : 'An unexpected server error occurred.' })
})

async function start() {
  if (IS_PRODUCTION && !pool) throw new Error('DATABASE_URL is required in production.')
  if (pool) {
    await pool.query('SELECT 1')
    await pool.query('SELECT id, name FROM merchants LIMIT 1')
    console.info('[KashNode] Database startup check passed (merchants table is queryable).')
    if (ADMIN_EMAIL && ADMIN_PASSWORD_HASH) {
      await pool.query(`INSERT INTO users (email, name, password_hash, role)
        VALUES ($1, $2, $3, 'admin') ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, password_hash=EXCLUDED.password_hash, role='admin'`,
      [ADMIN_EMAIL, process.env.KASHNODE_ADMIN_NAME || 'Workspace Admin', ADMIN_PASSWORD_HASH])
    }
  }
  httpServer.listen(PORT, HOST, () => console.info(`KashNode API + voice WebSocket listening on http://${HOST}:${PORT} (${NODE_ENV})`))
}

start().catch(error => {
  console.error('[KashNode] Startup failed:', error)
  process.exitCode = 1
})
