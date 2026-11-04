const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 5000
const domainCache = new Map()
const inflight = new Map()

// Fast local protection for well-known disposable services. The remote
// provider remains the authoritative check for every uncached domain.
const knownDisposableDomains = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'yopmail.com',
  'getnada.com',
  'sharklasers.com',
  'dispostable.com',
  'throwawaymail.com',
  'fakeinbox.com',
  'maildrop.cc',
])

function normalizeDomain(email) {
  if (typeof email !== 'string') return null
  const parts = email.trim().toLowerCase().split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  return parts[1].replace(/\.$/, '')
}

function matchesKnownDomain(domain) {
  for (const blocked of knownDisposableDomains) {
    if (domain === blocked || domain.endsWith(`.${blocked}`)) return true
  }
  return false
}

export class DisposableCheckUnavailableError extends Error {
  constructor(message = 'Disposable email verification is temporarily unavailable.') {
    super(message)
    this.name = 'DisposableCheckUnavailableError'
  }
}

/**
 * Checks the domain through Kickbox's public disposable-domain endpoint.
 * Results are cached for six hours to avoid making one network request per
 * signup. On an upstream error, the caller must fail closed and not send OTP.
 */
export async function isDisposableEmail(email, { fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const domain = normalizeDomain(email)
  if (!domain) throw new TypeError('A valid email address is required.')
  if (matchesKnownDomain(domain)) return true

  const cached = domainCache.get(domain)
  if (cached && cached.expiresAt > now()) return cached.disposable
  if (inflight.has(domain)) return inflight.get(domain)

  const request = (async () => {
    let response
    try {
      response = await fetchImpl(`https://open.kickbox.io/v1/disposable/${encodeURIComponent(domain)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      throw new DisposableCheckUnavailableError()
    }

    if (!response.ok) throw new DisposableCheckUnavailableError()
    let payload
    try {
      payload = await response.json()
    } catch {
      throw new DisposableCheckUnavailableError()
    }
    if (typeof payload?.disposable !== 'boolean') throw new DisposableCheckUnavailableError()

    if (domainCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = domainCache.keys().next().value
      if (oldest) domainCache.delete(oldest)
    }
    domainCache.set(domain, { disposable: payload.disposable, expiresAt: now() + CACHE_TTL_MS })
    return payload.disposable
  })()

  inflight.set(domain, request)
  try {
    return await request
  } finally {
    inflight.delete(domain)
  }
}

export function clearDisposableEmailCache() {
  domainCache.clear()
  inflight.clear()
}
