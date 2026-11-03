import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Mic, ShieldCheck, Volume2, VolumeX } from 'lucide-react'
import KashNodeMotionScene from '../components/KashNodeMotionScene'
import KashNodeLogo from '../components/KashNodeLogo'
import { signIn, signUp, type AuthUser } from '../lib/auth'

type Props = { onLogin: (user: AuthUser) => void; sessionError?: string }
type Mode = 'login' | 'signup'
type Step = 'name' | 'email' | 'password'

const getPrompt = (mode: Mode, step: Step) => {
  if (mode === 'signup') {
    if (step === 'name') return "Welcome to KashNode, your AI commerce command center. What should I call you?"
    if (step === 'email') return "Great to meet you. What's your email address?"
    return 'Create a strong password for your new KashNode account.'
  }
  return step === 'email' ? "Hi, I'm Kash, your AI commerce co-pilot. Sign in to manage payments, orders, customer calls, and daily operations from one command center. What's your email?" : 'Welcome back. Your commerce command center is ready. Enter your password to continue.'
}

export default function LoginPage({ onLogin, sessionError }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('email')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [prompt, setPrompt] = useState(getPrompt('login', 'email'))
  const [visibleChars, setVisibleChars] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [focused, setFocused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [voiceSpeaking, setVoiceSpeaking] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const voiceStartTimer = useRef<number | null>(null)
  const voiceWatchdog = useRef<number | null>(null)
  const autoVoiceStarted = useRef(false)
  const autoGestureCleanup = useRef<(() => void) | null>(null)
  const activeUtterance = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVisibleChars(prompt.length); return }
    setVisibleChars(0)
    let index = 0
    const timer = window.setInterval(() => { index += 1; setVisibleChars(index); if (index >= prompt.length) window.clearInterval(timer) }, 20)
    return () => window.clearInterval(timer)
  }, [prompt])

  useEffect(() => { inputRef.current?.focus() }, [step, mode])
  useEffect(() => () => {
    activeUtterance.current = null
    autoGestureCleanup.current?.()
    window.speechSynthesis?.cancel()
    if (voiceStartTimer.current !== null) window.clearTimeout(voiceStartTimer.current)
    if (voiceWatchdog.current !== null) window.clearTimeout(voiceWatchdog.current)
  }, [])

  const toggleVoiceIntro = () => {
    autoGestureCleanup.current?.()
    autoGestureCleanup.current = null
    autoVoiceStarted.current = true
    const speech = window.speechSynthesis
    if (!speech) { setVoiceStatus('This browser does not support voice playback. Try the latest Chrome or Edge.'); return }
    if (voiceSpeaking) {
      activeUtterance.current = null
      speech.cancel()
      if (voiceStartTimer.current !== null) window.clearTimeout(voiceStartTimer.current)
      if (voiceWatchdog.current !== null) window.clearTimeout(voiceWatchdog.current)
      setVoiceSpeaking(false); setVoiceStatus('Voice intro stopped.'); return
    }
    activeUtterance.current = null
    speech.cancel()
    setVoiceStatus('Starting Kash voice…')
    const line = "Hi, I'm Kash, your AI commerce operations partner. I help bring payments, orders, customer calls, and everyday workflows together in one command center. Sign in and let's get started."
    const utterance = new SpeechSynthesisUtterance(line)
    activeUtterance.current = utterance
    utterance.lang = 'en-US'
    utterance.rate = .88
    utterance.pitch = 1
    const chooseVoice = () => speech.getVoices().find(item => /^en-US$/i.test(item.lang)) || speech.getVoices().find(item => item.lang.toLowerCase().startsWith('en'))
    const voice = chooseVoice()
    if (voice) utterance.voice = voice
    let hasStarted = false
    utterance.onstart = () => { hasStarted = true; setVoiceSpeaking(true); setVoiceStatus('Kash is speaking.') }
    utterance.onend = () => {
      if (voiceWatchdog.current !== null) window.clearTimeout(voiceWatchdog.current)
      activeUtterance.current = null
      setVoiceSpeaking(false); setVoiceStatus('')
    }
    utterance.onerror = event => {
      if (activeUtterance.current !== utterance) return
      if (voiceWatchdog.current !== null) window.clearTimeout(voiceWatchdog.current)
      activeUtterance.current = null
      setVoiceSpeaking(false)
      if (event.error === 'not-allowed') {
        setVoiceStatus('Chrome blocks sound before interaction. Kash will speak when you click or type anywhere on this page.')
        const resumeOnGesture = (gesture: Event) => {
          const target = gesture.target
          if (target instanceof Element && target.closest('.km-voice-preview')) return
          autoGestureCleanup.current?.()
          autoGestureCleanup.current = null
          activeUtterance.current = null
          setVoiceSpeaking(false)
          window.setTimeout(() => toggleVoiceIntro(), 0)
        }
        document.addEventListener('pointerdown', resumeOnGesture)
        document.addEventListener('keydown', resumeOnGesture)
        autoGestureCleanup.current = () => {
          document.removeEventListener('pointerdown', resumeOnGesture)
          document.removeEventListener('keydown', resumeOnGesture)
        }
      } else {
        setVoiceStatus(`Voice playback failed (${event.error}). Check Windows sound output and browser speech settings.`)
      }
    }
    setVoiceSpeaking(true)
    voiceStartTimer.current = window.setTimeout(() => {
      if (!chooseVoice()) speech.getVoices()
      speech.resume()
      try { speech.speak(utterance) } catch { setVoiceSpeaking(false); setVoiceStatus('Voice playback could not start. Check browser speech support.') }
    }, 180)
    voiceWatchdog.current = window.setTimeout(() => {
      if (hasStarted) return
      activeUtterance.current = null
      speech.cancel()
      setVoiceSpeaking(false)
      setVoiceStatus('No voice started. Check Windows sound output and available English voices.')
    }, 6000)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (autoVoiceStarted.current) return
      autoVoiceStarted.current = true
      toggleVoiceIntro()
    }, 900)
    return () => window.clearTimeout(timer)
  }, [])

  const changeMode = (next: Mode) => {
    setMode(next); setStep(next === 'signup' ? 'name' : 'email'); setError(''); setPassword(''); setShowPassword(false)
    setPrompt(getPrompt(next, next === 'signup' ? 'name' : 'email'))
  }
  const ask = (next: Step, message?: string) => { setStep(next); setPrompt(message || getPrompt(mode, next)); setError('') }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || done) return
    if (step === 'name') {
      if (name.trim().length < 2) { setError('Enter your name to continue.'); return }
      ask('email'); return
    }
    if (step === 'email') {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address to continue.'); return }
      setEmail(email.trim()); ask('password'); return
    }
    if (mode === 'signup' && password.length < 12) { setError('Use at least 12 characters for a stronger password.'); return }
    if (!password) { setError('Enter your password to continue.'); return }
    void completeAuth()
  }

  async function completeAuth() {
    setBusy(true); setError(''); setPrompt(mode === 'signup' ? 'Creating your secure KashNode account…' : 'Checking your secure session…')
    try {
      const user = mode === 'signup' ? await signUp(name.trim(), email.trim(), password) : await signIn(email.trim(), password, keepSignedIn)
      setDone(true); setPrompt(mode === 'signup' ? 'Your account is ready. Welcome to KashNode.' : "You're in. Opening your command center.")
      window.setTimeout(() => onLogin(user), 650)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : mode === 'signup' ? 'Account creation failed. Please try again.' : 'Sign in failed. Please check your details.'
      setBusy(false); setError(message); setPrompt(mode === 'signup' ? 'I could not create that account. Please check the details.' : "I couldn't verify those details. Let's try your password again."); setStep('password')
    }
  }

  const isPassword = step === 'password'
  const promptSpeaking = visibleChars < prompt.length || busy || done
  const fieldLabel = step === 'name' ? 'Your name' : isPassword ? 'Password' : 'Email address'
  const stepNumber = mode === 'signup' ? (step === 'name' ? 1 : step === 'email' ? 2 : 3) : (isPassword ? 2 : 1)
  const stepTotal = mode === 'signup' ? 3 : 2
  const goBack = () => ask(mode === 'signup' ? (step === 'password' ? 'email' : 'name') : 'email')

  return <main className="km-login">
    <section className="km-visual" aria-label="KashNode animated AI guide">
      <div className="km-visual-image" aria-hidden="true"><img src="/images/kashnode-ai-login.jpg" alt="" /></div>
      <div className="km-visual-shade" aria-hidden="true" /><div className="km-visual-grid" aria-hidden="true" />
      <KashNodeMotionScene speaking={promptSpeaking || voiceSpeaking} focused={focused} busy={busy || done} />
      <header className="km-brand"><KashNodeLogo showTagline /><span className="km-brand-pill"><Mic size={12} /> AI VOICE OS</span></header>
      <div className="km-scene-caption"><i /><span>YOUR AI COMMERCE COMPANION</span></div>
    </section>
    <section className="km-auth" aria-label={mode === 'signup' ? 'Create your KashNode account' : 'Sign in to KashNode'}>
      <div className="km-auth-content">
        <div className="km-progress-row"><div className="km-progress-dots" role="progressbar" aria-label={`${mode === 'signup' ? 'Sign-up' : 'Sign-in'} steps`} aria-valuemin={1} aria-valuemax={stepTotal} aria-valuenow={stepNumber}>{Array.from({ length: stepTotal }, (_, i) => <i key={i} className={i < stepNumber ? 'active' : ''} />)}</div><span>{mode === 'signup' ? 'Create account' : 'Sign in'}</span><button type="button" className="km-voice-preview" onClick={toggleVoiceIntro} aria-label={voiceSpeaking ? 'Stop Kash voice introduction' : 'Hear Kash voice introduction'}>{voiceSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}{voiceSpeaking ? 'Stop' : 'Hear Kash'}</button><span className="km-step-count">0{stepNumber}<i />0{stepTotal}</span></div>
        {voiceStatus && <div className="km-voice-status" role="status" aria-live="polite">{voiceStatus}</div>}
          <h1 className="km-prompt" aria-live="polite"><span className="km-prompt-full sr-only">{prompt}</span><span aria-hidden="true">{Array.from(prompt).slice(0, visibleChars).join('')}{promptSpeaking && <i className="km-caret" />}</span></h1>
        {(error || sessionError) && <div className="km-error" role="alert">{error || sessionError}</div>}
        <form className="km-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="km-login-input">{fieldLabel}</label>
          <div className={`km-input-wrap ${focused ? 'focused' : ''}`}>
            <input ref={inputRef} id="km-login-input" name={step === 'name' ? 'name' : isPassword ? 'password' : 'email'} key={`${mode}-${step}`} type={step === 'name' ? 'text' : isPassword ? (showPassword ? 'text' : 'password') : 'email'} inputMode={step === 'email' ? 'email' : undefined} autoComplete={step === 'name' ? 'name' : step === 'email' ? 'email' : mode === 'signup' ? 'new-password' : 'current-password'} spellCheck={step === 'email' ? false : undefined} aria-label={fieldLabel} placeholder={step === 'name' ? 'Your name' : isPassword ? (mode === 'signup' ? 'At least 12 characters' : 'Enter your password') : 'you@company.com'} value={step === 'name' ? name : isPassword ? password : email} onChange={event => step === 'name' ? setName(event.target.value) : isPassword ? setPassword(event.target.value) : setEmail(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} disabled={busy || done} required minLength={isPassword && mode === 'signup' ? 12 : undefined} />
            {isPassword && <button type="button" className="km-eye" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>}
            <button className="km-submit" type="submit" disabled={busy || done} aria-label={isPassword ? mode === 'signup' ? 'Create account' : 'Sign in' : 'Continue'}>{busy ? <Loader2 size={19} className="km-spinner" /> : <ArrowRight size={21} />}</button>
          </div>
          {isPassword && mode === 'login' && <div className="km-password-options"><label className="km-remember"><input type="checkbox" checked={keepSignedIn} onChange={event => setKeepSignedIn(event.target.checked)} /><span>Keep me signed in</span></label><button type="button" className="km-forgot" onClick={() => { setError('Password reset is not configured yet.'); setPrompt('Password reset will be available soon.') }}>Forgot password?</button></div>}
          {step !== (mode === 'signup' ? 'name' : 'email') && <button type="button" className="km-back" onClick={goBack} disabled={busy || done}><ArrowLeft size={15} /> Back</button>}
        </form>
        <div className="km-signup">{mode === 'login' ? <>New here? <button type="button" onClick={() => changeMode('signup')}>Create an account</button></> : <>Already have an account? <button type="button" onClick={() => changeMode('login')}>Sign in</button></>}</div>
        <footer className="km-footer"><span><ShieldCheck size={14} /> Encrypted session · © {new Date().getFullYear()} KashNode</span><span><a href="#privacy">Privacy Policy</a><a href="#terms">Terms of Service</a></span></footer>
      </div>
    </section>
  </main>
}
