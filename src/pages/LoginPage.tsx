import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, ShieldCheck } from 'lucide-react'
import KashNodeLogo from '../components/KashNodeLogo'
import {
  getGoogleSignInNonce,
  requestSignupOtp,
  signIn,
  signInWithGoogleCredential,
  verifySignupOtp,
  type AuthUser,
} from '../lib/auth'

type Props = { onLogin: (user: AuthUser) => void; sessionError?: string; initialMode?: Mode }
type Mode = 'login' | 'signup'
type SignupStep = 'details' | 'otp'

/**
 * Google sign-in uses the backend that already exists in this repo:
 * POST /api/auth/google/nonce, then Google Identity Services returns an
 * ID token, then POST /api/auth/google verifies it server-side.
 * The browser client id must be the same Google web OAuth client as the
 * server's GOOGLE_CLIENT_ID, exposed to Vite as VITE_GOOGLE_CLIENT_ID.
 * No client id is committed here, so without that env var the button
 * explains the missing configuration instead of pretending to work.
 */
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

type GooglePromptNotification = {
  isDisplayed: () => boolean
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
  isDismissedMoment: () => boolean
  getNotDisplayedReason: () => string
  getSkippedReason: () => string
  getDismissedReason: () => string
}

type GoogleId = {
  initialize: (config: {
    client_id: string
    callback: (response: { credential?: string }) => void
    nonce?: string
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  prompt: (callback?: (notification: GooglePromptNotification) => void) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

function loadGoogleIdentityServices(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id)
      else reject(new Error('Google sign-in could not be loaded.'))
    }
    script.onerror = () => reject(new Error('Google sign-in could not be loaded. Check your connection and try again.'))
    document.head.appendChild(script)
  })
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29H1.29a12 12 0 0 0 0 10.58l3.98-3Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 7.2l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  )
}

export default function LoginPage({ onLogin, sessionError, initialMode = 'login' }: Props) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const requestedPlan = params.get('plan')?.toLowerCase() || 'basic'
  const requestedGateway = params.get('gateway')?.toLowerCase() || 'app'
  const [selectedPlan] = useState<'basic' | 'standard' | 'premium'>(['basic', 'standard', 'premium'].includes(requestedPlan) ? requestedPlan as 'basic' | 'standard' | 'premium' : 'basic')
  const [selectedGateway, setSelectedGateway] = useState<'app' | 'box'>(requestedGateway === 'box' ? 'box' : 'app')
  const [mode, setMode] = useState<Mode>(initialMode)
  const [signupStep, setSignupStep] = useState<SignupStep>('details')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [themeChoice, setThemeChoice] = useState<'dark' | 'system'>('dark')
  const [systemIsLight, setSystemIsLight] = useState(false)

  useEffect(() => {
    document.title = 'KashNode — Sign in'
  }, [])

  // Dark is the default, matching kashnode.com. System follows the device,
  // using the main site's own light palette when the device prefers light.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)')
    const update = () => setSystemIsLight(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const resolvedTheme = themeChoice === 'dark' || !systemIsLight ? 'dark' : 'light'

  const switchMode = (next: Mode) => {
    setMode(next)
    setSignupStep('details')
    setError('')
    setNotice('')
    setOtp('')
  }

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim())

  async function handleGoogle() {
    if (googleBusy || busy) return
    if (!GOOGLE_CLIENT_ID) {
      setError(
        'Google sign-in is not configured yet. Set VITE_GOOGLE_CLIENT_ID (the same Google web OAuth client as the server GOOGLE_CLIENT_ID) and try again.',
      )
      return
    }
    setGoogleBusy(true)
    setError('')
    setNotice('')
    try {
      const nonce = await getGoogleSignInNonce()
      const googleId = await loadGoogleIdentityServices()
      await new Promise<void>((resolve) => {
        let settled = false
        const finish = () => {
          if (!settled) {
            settled = true
            setGoogleBusy(false)
            resolve()
          }
        }
        googleId.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: async (response) => {
            try {
              if (!response.credential) throw new Error('Google did not return a sign-in credential.')
              const user = await signInWithGoogleCredential(response.credential, mode === 'signup' ? { plan: selectedPlan, gateway: selectedGateway } : {})
              onLogin(user)
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Google sign-in failed. Please try again.')
            } finally {
              finish()
            }
          },
        })
        googleId.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
            const reason =
              notification.getNotDisplayedReason?.() ||
              notification.getSkippedReason?.() ||
              notification.getDismissedReason?.() ||
              'closed'
            setError(`Google sign-in prompt was ${reason}. Try again, or sign in with email and password.`)
            finish()
          }
        })
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign-in failed. Please try again.')
      setGoogleBusy(false)
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || googleBusy) return
    if (!validEmail) {
      setError('Enter a valid email address to continue.')
      return
    }
    if (!password) {
      setError('Enter your password to continue.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const user = await signIn(email.trim(), password, keepSignedIn)
      onLogin(user)
    } catch (cause) {
      setBusy(false)
      setError(cause instanceof Error ? cause.message : 'Sign in failed. Please check your details.')
    }
  }

  async function handleSignupDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || googleBusy) return
    if (name.trim().length < 2) {
      setError('Enter your name to continue.')
      return
    }
    if (!validEmail) {
      setError('Enter a valid email address to continue.')
      return
    }
    // The backend requires 12–128 characters before it will send an OTP.
    if (password.length < 12) {
      setError('Use at least 12 characters for a stronger password.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await requestSignupOtp(name.trim(), email.trim(), password, { plan: selectedPlan, gateway: selectedGateway })
      setOtp('')
      setSignupStep('otp')
      setNotice(`We sent a 6-digit code to ${email.trim()}. It expires in 10 minutes.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the verification code.')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || googleBusy) return
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the six-digit code from your email.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const user = await verifySignupOtp(email.trim(), otp.trim())
      onLogin(user)
    } catch (cause) {
      setBusy(false)
      setError(cause instanceof Error ? cause.message : 'Could not verify the code.')
    }
  }

  return (
    <main className="auth-page" data-auth-theme={resolvedTheme}>
      <header className="auth-header">
        <a href="/" className="auth-header-brand" aria-label="KashNode home">
          <KashNodeLogo showTagline />
        </a>
        <div className="auth-theme" role="group" aria-label="Theme">
          <button type="button" aria-pressed={themeChoice === 'dark'} className={themeChoice === 'dark' ? 'active' : ''} onClick={() => setThemeChoice('dark')}>
            Dark
          </button>
          <button type="button" aria-pressed={themeChoice === 'system'} className={themeChoice === 'system' ? 'active' : ''} onClick={() => setThemeChoice('system')}>
            System
          </button>
        </div>
      </header>

      <section className="auth-card" aria-label={mode === 'login' ? 'Sign in to KashNode' : 'Create your free KashNode account'}>
        <div className="auth-heading">
          <h1>{mode === 'login' ? 'Sign in to KashNode' : signupStep === 'otp' ? 'Verify your email' : 'Create your account'}</h1>
          <p>{mode === 'login' ? 'Enter your details to continue.' : signupStep === 'otp' ? 'Enter the code we sent to your email.' : 'Your selected package and gateway will be saved to your workspace.'}</p>
        </div>

        <button type="button" className="auth-google" onClick={handleGoogle} disabled={googleBusy || busy}>
          {googleBusy ? <Loader2 size={18} className="auth-spinner" /> : <GoogleMark />}
          {googleBusy ? 'Connecting to Google…' : mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
        </button>

        <div className="auth-divider" aria-hidden="true">
          <span>or continue with email</span>
        </div>

        {(error || sessionError) && (
          <div className="auth-error" role="alert">
            {error || sessionError}
          </div>
        )}
        {notice && (
          <div className="auth-notice" role="status">
            {notice}
          </div>
        )}

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>Email address</span>
              <input type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy || googleBusy} required />
            </label>
            <label>
              <span>Password</span>
              <span className="auth-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy || googleBusy}
                  required
                />
                <button type="button" className="auth-eye" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <div className="auth-row">
              <label className="auth-remember">
                <input type="checkbox" checked={keepSignedIn} onChange={(event) => setKeepSignedIn(event.target.checked)} />
                <span>Keep me signed in</span>
              </label>
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setError('Password reset is not configured yet.')
                  setNotice('')
                }}
              >
                Forgot password?
              </button>
            </div>
            <button type="submit" className="auth-submit" disabled={busy || googleBusy}>
              {busy ? <Loader2 size={18} className="auth-spinner" /> : null}
              {busy ? 'Signing you in…' : 'Sign in'}
            </button>
          </form>
        ) : signupStep === 'details' ? (
          <>
            <ol className="auth-steps" aria-label="Free account signup steps">
              <li className="current"><strong>1</strong><span>Enter email &amp; account details</span></li>
              <li><strong>2</strong><span>Receive 6-digit OTP</span></li>
              <li><strong>3</strong><span>Verify &amp; create account</span></li>
            </ol>
            <div className="auth-selection-card">
              <div><strong>Selected package</strong><span>{selectedPlan[0].toUpperCase() + selectedPlan.slice(1)}</span></div>
              <div className="auth-gateway-options">
                <label><input type="radio" name="signup-gateway" checked={selectedGateway === 'app'} onChange={() => setSelectedGateway('app')} /><span><strong>Kash AI App</strong><small>Free Android gateway</small></span></label>
                <label><input type="radio" name="signup-gateway" checked={selectedGateway === 'box'} onChange={() => setSelectedGateway('box')} /><span><strong>KashNode Box</strong><small>Dedicated hardware · pre-order inquiry</small></span></label>
              </div>
            </div>
            <form className="auth-form" onSubmit={handleSignupDetails}>
              <label>
                <span>Your name</span>
                <input type="text" autoComplete="name" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} disabled={busy || googleBusy} required />
              </label>
              <label>
                <span>Email address</span>
                <input type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy || googleBusy} required />
              </label>
              <label>
                <span>Password</span>
                <span className="auth-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={busy || googleBusy}
                    required
                    minLength={12}
                  />
                  <button type="button" className="auth-eye" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              <p className="auth-hint">We will send a 6-digit OTP to this email. Your account is created only after you verify it.</p>
              <button type="submit" className="auth-submit" disabled={busy || googleBusy}>
                {busy ? <Loader2 size={18} className="auth-spinner" /> : <Mail size={18} />}
                {busy ? 'Sending OTP…' : 'Send OTP & continue'}
              </button>
            </form>
          </>
        ) : (
          <>
            <ol className="auth-steps" aria-label="Free account signup steps">
              <li className="done"><strong>✓</strong><span>Enter email &amp; account details</span></li>
              <li className="current"><strong>2</strong><span>Receive 6-digit OTP</span></li>
              <li><strong>3</strong><span>Verify &amp; create account</span></li>
            </ol>
            <form className="auth-form" onSubmit={handleVerifyOtp}>
              <label>
                <span>6-digit OTP sent to {email.trim()}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={busy || googleBusy}
                  required
                  maxLength={6}
                  className="auth-otp-input"
                />
              </label>
              <button type="submit" className="auth-submit" disabled={busy || googleBusy}>
                {busy ? <Loader2 size={18} className="auth-spinner" /> : <ShieldCheck size={18} />}
                {busy ? 'Verifying…' : 'Verify & create free account'}
              </button>
              <div className="auth-row">
                <button type="button" className="auth-link" onClick={() => setSignupStep('details')} disabled={busy || googleBusy}>
                  <ArrowLeft size={15} /> Back to details
                </button>
                <button
                  type="button"
                  className="auth-link"
                  disabled={busy || googleBusy}
                  onClick={async () => {
                    setBusy(true)
                    setError('')
                    try {
                      await requestSignupOtp(name.trim(), email.trim(), password, { plan: selectedPlan, gateway: selectedGateway })
                      setNotice(`A new 6-digit code was sent to ${email.trim()}. It expires in 10 minutes.`)
                    } catch (cause) {
                      setError(cause instanceof Error ? cause.message : 'Could not resend the code.')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Resend code
                </button>
              </div>
            </form>
          </>
        )}

        <p className="auth-switch">
          {mode === 'login' ? (
            <>New here? <button type="button" onClick={() => switchMode('signup')}>Create a free account</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => switchMode('login')}>Sign in</button></>
          )}
        </p>
      </section>
      <footer className="auth-page-footer">© {new Date().getFullYear()} KashNode</footer>
    </main>
  )
}
