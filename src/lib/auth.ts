export type AuthUser = { id: string; email: string; name?: string; role?: string; merchantId?: string }

export type MerchantOnboardingProfile = {
  isOnboardingComplete: boolean
  businessName: string
  websiteUrl: string
  adminContactPhone: string
  boxSimPhone: string
  selectedPlan: 'basic' | 'standard' | 'premium'
  gatewayPreference: 'app' | 'box'
  boxFulfillmentStatus: string
  boxPreorderRequestedAt: string | null
}

export type MerchantOnboardingInput = Omit<MerchantOnboardingProfile, 'isOnboardingComplete'>

/**
 * The API should verify the password and set a Secure, HttpOnly, SameSite=Lax
 * session/JWT cookie. The browser never receives or stores a bearer token.
 */
export async function signIn(email: string, password: string, rememberMe = false): Promise<AuthUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password, rememberMe }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Could not sign in with those details.')
  if (!payload.user?.id || !payload.user?.email) throw new Error('The authentication server returned an invalid response.')
  return payload.user as AuthUser
}

export async function requestSignupOtp(name: string, email: string, password: string, selection: { plan?: string; gateway?: string } = {}): Promise<void> {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name, email, password, plan: selection.plan, gateway: selection.gateway }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Could not send the verification code.')
}

export async function verifySignupOtp(email: string, otp: string): Promise<AuthUser> {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, otp }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Could not verify the code.')
  if (!payload.user?.id || !payload.user?.email) throw new Error('The authentication server returned an invalid response.')
  return payload.user as AuthUser
}


export async function getGoogleSignInNonce(): Promise<string> {
  const response = await fetch('/api/auth/google/nonce', {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || typeof payload.nonce !== 'string') {
    throw new Error(payload.message || 'Could not start Google sign-in securely.')
  }
  return payload.nonce
}

export async function signInWithGoogleCredential(credential: string, selection: { plan?: string; gateway?: string } = {}): Promise<AuthUser> {
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ credential, plan: selection.plan, gateway: selection.gateway }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Could not sign in with Google.')
  if (!payload.user?.id || !payload.user?.email) throw new Error('The authentication server returned an invalid response.')
  return payload.user as AuthUser
}

export async function getSession(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/session', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (response.status === 401) return null
  if (!response.ok) throw new Error('Could not verify your session.')
  const payload = await response.json()
  return payload.user?.id && payload.user?.email ? payload.user as AuthUser : null
}

export async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
}


async function readApiPayload(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || fallbackMessage)
  return payload
}

export async function getMerchantOnboarding(): Promise<MerchantOnboardingProfile> {
  const response = await fetch('/api/merchant/onboarding', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const payload = await readApiPayload(response, 'Could not load merchant onboarding status.')
  if (!payload.onboarding || typeof payload.onboarding.isOnboardingComplete !== 'boolean') {
    throw new Error('The onboarding API returned an invalid response.')
  }
  return payload.onboarding as MerchantOnboardingProfile
}

export async function saveMerchantOnboarding(input: MerchantOnboardingInput): Promise<MerchantOnboardingProfile> {
  const response = await fetch('/api/merchant/onboarding', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = await readApiPayload(response, 'Could not save merchant onboarding details.')
  if (!payload.onboarding?.isOnboardingComplete) {
    throw new Error('The server did not confirm that onboarding is complete.')
  }
  return payload.onboarding as MerchantOnboardingProfile
}

export async function getMerchantCredentials(): Promise<{ merchantSecretKey: string }> {
  const response = await fetch('/api/merchant/credentials', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const payload = await readApiPayload(response, 'Could not load your merchant API secret.')
  if (typeof payload.merchantSecretKey !== 'string' || !payload.merchantSecretKey) {
    throw new Error('The server did not return a merchant API secret.')
  }
  return { merchantSecretKey: payload.merchantSecretKey }
}
