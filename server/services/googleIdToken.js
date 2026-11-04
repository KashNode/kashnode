import crypto from 'node:crypto'

let cachedKeys = null
let cacheExpiresAt = 0

function decodePart(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
}

async function loadGoogleKeys(fetchImpl, now, force = false) {
  if (!force && cachedKeys && cacheExpiresAt > now()) return cachedKeys

  let response
  try {
    response = await fetchImpl('https://www.googleapis.com/oauth2/v3/certs', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new Error('Google identity verification is temporarily unavailable.')
  }
  if (!response.ok) throw new Error('Google identity verification is temporarily unavailable.')

  const payload = await response.json().catch(() => null)
  if (!Array.isArray(payload?.keys) || payload.keys.length === 0) {
    throw new Error('Google identity verification returned invalid signing keys.')
  }

  const cacheControl = response.headers?.get?.('cache-control') || ''
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i)
  const maxAgeSeconds = maxAgeMatch ? Math.min(Number(maxAgeMatch[1]), 24 * 60 * 60) : 60 * 60
  cachedKeys = payload.keys
  cacheExpiresAt = now() + Math.max(60, maxAgeSeconds) * 1000
  return cachedKeys
}

/**
 * Verify a Google Identity Services ID token without trusting client-supplied
 * profile fields. Validates RS256 signature, issuer, audience, timestamps,
 * subject and the provider's verified-email claim.
 */
export async function verifyGoogleIdToken(token, {
  clientId = process.env.GOOGLE_CLIENT_ID,
  fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) {
  if (typeof token !== 'string' || token.length > 20000) throw new Error('A valid Google credential is required.')
  if (!clientId) throw new Error('Google sign-in is not configured.')

  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid Google credential.')
  let header
  let claims
  try {
    header = decodePart(parts[0])
    claims = decodePart(parts[1])
  } catch {
    throw new Error('Invalid Google credential.')
  }
  if (header?.alg !== 'RS256' || typeof header?.kid !== 'string') throw new Error('Unsupported Google credential signature.')

  let keys = await loadGoogleKeys(fetchImpl, now)
  let jwk = keys.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'))
  if (!jwk) {
    keys = await loadGoogleKeys(fetchImpl, now, true)
    jwk = keys.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'))
  }
  if (!jwk) throw new Error('Google credential signing key was not found.')

  let signatureValid = false
  try {
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' })
    signatureValid = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'))
  } catch {
    signatureValid = false
  }
  if (!signatureValid) throw new Error('Google credential signature is invalid.')

  const nowSeconds = Math.floor(now() / 1000)
  const issuerValid = claims?.iss === 'accounts.google.com' || claims?.iss === 'https://accounts.google.com'
  const audienceValid = claims?.aud === clientId || (Array.isArray(claims?.aud) && claims.aud.includes(clientId))
  const authorizedPartyValid = !Array.isArray(claims?.aud) || claims.azp === clientId
  if (!issuerValid || !audienceValid || !authorizedPartyValid) throw new Error('Google credential audience or issuer is invalid.')
  if (!Number.isFinite(claims?.exp) || claims.exp <= nowSeconds) throw new Error('Google credential has expired.')
  if (Number.isFinite(claims?.iat) && claims.iat > nowSeconds + 60) throw new Error('Google credential was issued in the future.')
  if (typeof claims?.sub !== 'string' || !claims.sub || claims.sub.length > 255) throw new Error('Google credential is missing a valid subject.')
  if (claims?.email_verified !== true && claims?.email_verified !== 'true') throw new Error('Google must confirm the email address before sign-in.')
  if (typeof claims?.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) || claims.email.length > 254) {
    throw new Error('Google credential does not contain a valid email address.')
  }

  return {
    sub: claims.sub,
    email: claims.email.trim().toLowerCase(),
    name: typeof claims.name === 'string' ? claims.name.trim().slice(0, 80) : '',
    picture: typeof claims.picture === 'string' && claims.picture.startsWith('https://') ? claims.picture : null,
  }
}

export function clearGoogleKeyCache() {
  cachedKeys = null
  cacheExpiresAt = 0
}
