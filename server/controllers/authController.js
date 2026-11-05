import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const OTP_TTL_MINUTES = 10
const MAX_OTP_ATTEMPTS = 5
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function hashOtp(email, otp, secret) {
  return crypto.createHmac('sha256', secret).update(`${email}:${otp}`).digest()
}

function equalHash(left, right) {
  const a = Buffer.isBuffer(left) ? left : Buffer.from(String(left || ''), 'hex')
  const b = Buffer.isBuffer(right) ? right : Buffer.from(String(right || ''), 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function publicUser(row, merchantId) {
  return {
    id: String(row.id),
    email: row.email,
    name: row.name || row.email,
    role: row.role || 'user',
    ...(merchantId ? { merchantId: String(merchantId) } : {}),
  }
}

function validateSignupBody(body) {
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const email = normalizeEmail(body?.email)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (name.length < 2 || name.length > 80 || !EMAIL_PATTERN.test(email) || email.length > 254) {
    return { error: 'Enter a valid name and email address.' }
  }
  if (password.length < 12 || password.length > 128) {
    return { error: 'Password must be between 12 and 128 characters.' }
  }
  return { name, email, password }
}

export function createAuthController({
  pool,
  createUserSession,
  sendOtpEmail,
  checkDisposableEmail,
  verifyGoogleCredential,
  otpSecret = process.env.AUTH_OTP_SECRET,
}) {
  const otpSecretReady = typeof otpSecret === 'string' && Buffer.byteLength(otpSecret, 'utf8') >= 32

  async function signup(req, res) {
    if (!pool || !otpSecretReady || typeof sendOtpEmail !== 'function' || typeof checkDisposableEmail !== 'function') {
      return res.status(503).json({ status: 'error', message: 'Account verification is not configured on this server.' })
    }

    const input = validateSignupBody(req.body)
    if (input.error) return res.status(400).json({ status: 'error', message: input.error })

    let disposable
    try {
      disposable = await checkDisposableEmail(input.email)
    } catch (error) {
      console.error('[KashNode Auth] Disposable-email check failed:', error.message)
      return res.status(503).json({ status: 'error', message: 'Email verification is temporarily unavailable. Please try again.' })
    }
    if (disposable) {
      return res.status(422).json({ status: 'error', message: 'Temporary or disposable email addresses are not accepted. Use a permanent email address.' })
    }

    const existing = await pool.query(
      'SELECT id FROM public.users WHERE lower(email) = $1 LIMIT 1',
      [input.email],
    )
    if (existing.rows.length) {
      return res.status(409).json({ status: 'error', message: 'An account with this email already exists. Sign in instead.' })
    }

    const otp = String(crypto.randomInt(100000, 1000000))
    const passwordHash = await bcrypt.hash(input.password, 12)
    const otpHash = hashOtp(input.email, otp, otpSecret).toString('hex')

    await pool.query(
      `INSERT INTO public.merchant_signup_otps (email, name, password_hash, otp_hash, attempts, expires_at)
       VALUES ($1, $2, $3, $4, 0, NOW() + INTERVAL '${OTP_TTL_MINUTES} minutes')
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           otp_hash = EXCLUDED.otp_hash,
           attempts = 0,
           created_at = NOW(),
           expires_at = EXCLUDED.expires_at`,
      [input.email, input.name, passwordHash, otpHash],
    )

    try {
      const delivery = await sendOtpEmail({ to: input.email, name: input.name, otp })
      if (delivery?.id) {
        console.info(`[KashNode Auth] Signup verification email accepted by provider (id: ${delivery.id}).`)
      }
    } catch (error) {
      await pool.query(
        'DELETE FROM public.merchant_signup_otps WHERE email = $1 AND otp_hash = $2',
        [input.email, otpHash],
      ).catch(cleanupError => {
        console.error('[KashNode Auth] Failed to clear an undelivered signup OTP challenge:', cleanupError.message)
      })
      console.error('[KashNode Auth] Signup email delivery failed:', {
        code: error?.code || 'EMAIL_DELIVERY_FAILED',
        message: error?.message || 'Unknown email delivery error.',
      })
      const configurationError = Number(error?.statusCode) === 503
      return res.status(configurationError ? 503 : 502).json({
        status: 'error',
        message: configurationError
          ? 'Email verification is not configured correctly. Please contact support.'
          : 'We could not send the verification email. Please try again.',
      })
    }

    return res.status(202).json({
      status: 'success',
      message: 'A six-digit verification code has been sent to your email address.',
      expiresInSeconds: OTP_TTL_MINUTES * 60,
    })
  }

  async function verifyOtp(req, res) {
    if (!pool || !otpSecretReady || typeof createUserSession !== 'function') {
      return res.status(503).json({ status: 'error', message: 'Account verification is not configured on this server.' })
    }
    const email = normalizeEmail(req.body?.email)
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : ''
    if (!EMAIL_PATTERN.test(email) || email.length > 254 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid email address and six-digit verification code.' })
    }

    const client = await pool.connect()
    let user = null
    let response = null
    try {
      await client.query('BEGIN')
      const pending = await client.query(
        `SELECT email, name, password_hash, otp_hash, attempts, expires_at
         FROM public.merchant_signup_otps
         WHERE email = $1
         FOR UPDATE`,
        [email],
      )
      const challenge = pending.rows[0]
      if (!challenge) {
        response = { status: 400, body: { status: 'error', message: 'The verification code is invalid or expired. Request a new code.' } }
      } else if (new Date(challenge.expires_at).getTime() <= Date.now()) {
        await client.query('DELETE FROM public.merchant_signup_otps WHERE email = $1', [email])
        response = { status: 400, body: { status: 'error', message: 'The verification code has expired. Request a new code.' } }
      } else if (Number(challenge.attempts) >= MAX_OTP_ATTEMPTS) {
        response = { status: 429, body: { status: 'error', message: 'Too many incorrect verification attempts. Request a new code.' } }
      } else if (!equalHash(hashOtp(email, otp, otpSecret), challenge.otp_hash)) {
        await client.query(
          'UPDATE public.merchant_signup_otps SET attempts = attempts + 1 WHERE email = $1',
          [email],
        )
        response = { status: 400, body: { status: 'error', message: 'The verification code is incorrect.' } }
      } else {
        const existing = await client.query(
          'SELECT id FROM public.users WHERE lower(email) = $1 FOR UPDATE',
          [email],
        )
        if (existing.rows.length) {
          await client.query('DELETE FROM public.merchant_signup_otps WHERE email = $1', [email])
          response = { status: 409, body: { status: 'error', message: 'An account with this email already exists. Sign in instead.' } }
        } else {
          const createdUser = await client.query(
            `INSERT INTO public.users (email, name, password_hash, role)
             VALUES ($1, $2, $3, 'user')
             RETURNING id, email, name, role`,
            [email, challenge.name, challenge.password_hash],
          )
          const row = createdUser.rows[0]
          const merchant = await client.query(
            `INSERT INTO public.merchants (name, email, owner_user_id)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [challenge.name, email, row.id],
          )
          await client.query('DELETE FROM public.merchant_signup_otps WHERE email = $1', [email])
          user = publicUser(row, merchant.rows[0]?.id)
        }
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if (error?.code === '23505') {
        return res.status(409).json({ status: 'error', message: 'An account with this email already exists. Sign in instead.' })
      }
      throw error
    } finally {
      client.release()
    }

    if (response) return res.status(response.status).json(response.body)
    if (!user) return res.status(500).json({ status: 'error', message: 'Account creation could not be completed.' })

    await createUserSession(req, user)
    return res.status(201).json({ status: 'success', user })
  }

  async function google(req, res) {
    if (!pool || typeof verifyGoogleCredential !== 'function' || !process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ status: 'error', message: 'Google sign-in is not configured on this server.' })
    }
    const credential = typeof req.body?.credential === 'string' ? req.body.credential : ''
    if (!credential) return res.status(400).json({ status: 'error', message: 'A Google credential is required.' })

    const expectedNonce = req.session?.googleNonce
    if (typeof expectedNonce !== 'string' || !expectedNonce) {
      return res.status(401).json({ status: 'error', message: 'Start Google sign-in again to obtain a fresh security challenge.' })
    }

    let identity
    try {
      identity = await verifyGoogleCredential(credential)
    } catch (error) {
      const unavailable = /temporarily unavailable|not configured/i.test(error.message)
      return res.status(unavailable ? 503 : 401).json({
        status: 'error',
        message: unavailable ? 'Google sign-in is temporarily unavailable.' : 'Google sign-in could not verify this account.',
      })
    }

    if (!identity.nonce || identity.nonce !== expectedNonce) {
      delete req.session.googleNonce
      await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()))
      return res.status(401).json({ status: 'error', message: 'Google sign-in security challenge did not match. Please try again.' })
    }
    delete req.session.googleNonce
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()))

    const client = await pool.connect()
    let user
    try {
      await client.query('BEGIN')
      let account = await client.query(
        'SELECT id, email, name, role, google_sub FROM public.users WHERE google_sub = $1 FOR UPDATE',
        [identity.sub],
      )

      if (!account.rows[0]) {
        account = await client.query(
          'SELECT id, email, name, role, google_sub FROM public.users WHERE lower(email) = $1 FOR UPDATE',
          [identity.email],
        )
        if (account.rows[0]) {
          const existing = account.rows[0]
          if (existing.role === 'admin' && !existing.google_sub) {
            await client.query('ROLLBACK')
            return res.status(403).json({ status: 'error', message: 'Administrator accounts must have Google sign-in linked by an administrator.' })
          }
          if (existing.google_sub && existing.google_sub !== identity.sub) {
            await client.query('ROLLBACK')
            return res.status(409).json({ status: 'error', message: 'This email is linked to a different Google account.' })
          }
          if (!existing.google_sub) {
            account = await client.query(
              'UPDATE public.users SET google_sub = $2 WHERE id = $1 RETURNING id, email, name, role, google_sub',
              [existing.id, identity.sub],
            )
          }
        } else {
          account = await client.query(
            `INSERT INTO public.users (email, name, password_hash, role, google_sub)
             VALUES ($1, $2, NULL, 'user', $3)
             RETURNING id, email, name, role, google_sub`,
            [identity.email, identity.name || identity.email, identity.sub],
          )
        }
      }

      const row = account.rows[0]
      let merchant = await client.query(
        'SELECT id FROM public.merchants WHERE owner_user_id = $1 FOR UPDATE',
        [row.id],
      )
      if (!merchant.rows[0]) {
        merchant = await client.query(
          `INSERT INTO public.merchants (name, email, owner_user_id)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [row.name || identity.name || identity.email, row.email, row.id],
        )
      }

      await client.query('COMMIT')
      user = publicUser(row, merchant.rows[0]?.id)
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if (error?.code === '23505') {
        return res.status(409).json({ status: 'error', message: 'This Google account is already linked or a workspace already exists.' })
      }
      throw error
    } finally {
      client.release()
    }

    await createUserSession(req, user)
    return res.json({ status: 'success', user })
  }

  return { signup, verifyOtp, google }
}
