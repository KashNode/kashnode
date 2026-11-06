import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Building2, CheckCircle2, Globe, Loader2, Phone, Smartphone } from 'lucide-react'
import KashNodeLogo from '../components/KashNodeLogo'
import { getMerchantOnboarding, saveMerchantOnboarding, requestBillingPhoneOtp, verifyBillingPhoneOtp } from '../lib/auth'

type Props = {
  onComplete: () => void
  setupLoadError?: string
}

type FormValues = {
  businessName: string
  websiteUrl: string
  adminContactPhone: string
  boxSimPhone: string
}

const emptyForm: FormValues = {
  businessName: '',
  websiteUrl: '',
  adminContactPhone: '',
  boxSimPhone: '',
}

export default function Onboarding({ onComplete, setupLoadError = '' }: Props) {
  const [form, setForm] = useState<FormValues>(emptyForm)
  const [gatewayPreference, setGatewayPreference] = useState<'app' | 'box'>('app')
  const [billingPhone, setBillingPhone] = useState('')
  const [billingOtp, setBillingOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [billingPhoneVerified, setBillingPhoneVerified] = useState(false)
  const [phoneBusy, setPhoneBusy] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('basic')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Set up your business — KashNode'
    let active = true

    getMerchantOnboarding()
      .then((profile) => {
        if (!active) return
        setForm({
          businessName: profile.businessName || '',
          websiteUrl: profile.websiteUrl || '',
          adminContactPhone: profile.adminContactPhone || '',
          boxSimPhone: profile.boxSimPhone || '',
        })
        setGatewayPreference(profile.gatewayPreference || 'app')
        setBillingPhone(profile.billingPhone || '')
        setBillingPhoneVerified(Boolean(profile.isBillingPhoneVerified))
        setSelectedPlan(profile.selectedPlan || 'basic')
      })
      .catch((cause) => {
        if (active && !setupLoadError) {
          setError(cause instanceof Error ? cause.message : 'Could not load your saved setup details.')
        }
      })
      .finally(() => {
        if (active) setLoadingProfile(false)
      })

    return () => {
      active = false
    }
  }, [setupLoadError])

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    if (!billingPhoneVerified) { setError('Verify your billing MFS number before completing setup.'); return }
    setSaving(true)
    setError('')
    try {
      await saveMerchantOnboarding({ ...form, gatewayMode: gatewayPreference === 'box' ? 'kashnode_box' : 'android_app' })
      onComplete()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your business setup. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <a href="/" className="onboarding-brand" aria-label="KashNode home"><KashNodeLogo showTagline /></a>
        <span className="onboarding-secure"><CheckCircle2 size={15} /> Secure workspace setup</span>
      </header>

      <div className="onboarding-layout">
        <section className="onboarding-intro">
          <p className="onboarding-kicker">ONE-TIME SETUP · STEP 1 OF 1</p>
          <h1>Let’s set up your business.</h1>
          <p className="onboarding-lede">
            Add your store details to activate your workspace. {gatewayPreference === 'box' ? 'You can provide your Box SIM number now or later.' : 'Your Kash AI App gateway works without a Box SIM, so you can start right away.'}
          </p>
          <div className="onboarding-points">
            <div><Building2 size={18} /><span><strong>Your business</strong><small>Identify the store connected to this workspace.</small></span></div>
            <div><Phone size={18} /><span><strong>Admin contact</strong><small>Where KashNode can reach your team.</small></span></div>
            {gatewayPreference === 'box' && <div><Smartphone size={18} /><span><strong>Pocket Box SIM</strong><small>The separate SIM installed in your device.</small></span></div>}
          </div>
        </section>

        <section className="onboarding-card" aria-labelledby="onboarding-title">
          <div className="onboarding-card-heading">
            <span className="onboarding-step">WORKSPACE DETAILS</span>
            <h2 id="onboarding-title">Business information</h2>
            <p>Complete the required fields to unlock your dashboard. {selectedPlan[0].toUpperCase() + selectedPlan.slice(1)} plan · {gatewayPreference === 'app' ? 'Kash AI App gateway' : 'KashNode Box gateway'}.</p>
          </div>

          {setupLoadError && (
            <p className="onboarding-warning" role="status">
              We couldn’t verify your saved setup details. You can still submit the form; please check your entries carefully.
            </p>
          )}
          {error && <p className="onboarding-error" role="alert">{error}</p>}

          <form className="onboarding-form" onSubmit={handleSubmit}>
            <div className="onboarding-gateway-choice">
              <strong>Choose your gateway setup</strong>
              <label><input type="radio" name="gatewayMode" checked={gatewayPreference === 'app'} onChange={() => setGatewayPreference('app')} disabled={saving || loadingProfile} /> <span><b>Kash AI Android App</b><small>Software gateway using your Android phone and SIM · Default</small></span></label>
              <label><input type="radio" name="gatewayMode" checked={gatewayPreference === 'box'} onChange={() => setGatewayPreference('box')} disabled={saving || loadingProfile} /> <span><b>KashNode Box</b><small>Optional dedicated standalone hardware device</small></span></label>
            </div>
            <label>
              <span>Business name <i>Required</i></span>
              <span className="onboarding-input-wrap">
                <Building2 size={18} />
                <input
                  type="text"
                  name="businessName"
                  autoComplete="organization"
                  placeholder="e.g. Dhaka Fashion House"
                  value={form.businessName}
                  onChange={(event) => update('businessName', event.target.value)}
                  maxLength={255}
                  required
                  disabled={saving || loadingProfile}
                />
              </span>
            </label>

            <label>
              <span>Website <i>Optional</i></span>
              <span className="onboarding-input-wrap">
                <Globe size={18} />
                <input
                  type="url"
                  name="websiteUrl"
                  autoComplete="url"
                  placeholder="https://yourstore.com"
                  value={form.websiteUrl}
                  onChange={(event) => update('websiteUrl', event.target.value)}
                  maxLength={2048}
                  disabled={saving || loadingProfile}
                />
              </span>
            </label>

            <label>
              <span>Admin contact phone <i>Required</i></span>
              <span className="onboarding-input-wrap">
                <Phone size={18} />
                <input
                  type="tel"
                  name="adminContactPhone"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="01XXXXXXXXX"
                  value={form.adminContactPhone}
                  onChange={(event) => update('adminContactPhone', event.target.value)}
                  maxLength={24}
                  pattern="(?:\+?88)?01[3-9][0-9]{8}"
                  title="Enter a valid Bangladesh mobile number, such as 01712345678 or +8801712345678."
                  required
                  disabled={saving || loadingProfile}
                />
              </span>
              <small className="onboarding-hint">Your team’s contact number. It can be different from the Box SIM.</small>
            </label>

            <label>
              <span>Primary billing MFS number <i>Required · bKash / Nagad / Rocket</i></span>
              <span className="onboarding-input-wrap"><Phone size={18} /><input type="tel" value={billingPhone} onChange={(event) => { setBillingPhone(event.target.value); setBillingPhoneVerified(false); setOtpSent(false) }} placeholder="01XXXXXXXXX" inputMode="tel" autoComplete="tel" pattern="(?:\+?88)?01[3-9][0-9]{8}" required disabled={saving || loadingProfile || billingPhoneVerified} /></span>
              <small className="onboarding-hint">This is the number you will use to Send Money for wallet top-ups.</small>
              {!billingPhoneVerified && <div className="onboarding-phone-verify">
                <button type="button" className="onboarding-secondary" disabled={phoneBusy || !billingPhone.trim()} onClick={async () => { setPhoneBusy(true); setError(''); try { await requestBillingPhoneOtp(billingPhone); setOtpSent(true) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send OTP.') } finally { setPhoneBusy(false) } }}>{phoneBusy ? 'Sending…' : otpSent ? 'Resend OTP' : 'Send 6-digit OTP'}</button>
                {otpSent && <><input aria-label="6-digit billing phone OTP" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={billingOtp} onChange={(event) => setBillingOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" /><button type="button" className="onboarding-secondary" disabled={phoneBusy || billingOtp.length !== 6} onClick={async () => { setPhoneBusy(true); setError(''); try { const result = await verifyBillingPhoneOtp(billingOtp); setBillingPhone(result.billingPhone); setBillingPhoneVerified(result.isBillingPhoneVerified) } catch (cause) { setError(cause instanceof Error ? cause.message : 'OTP verification failed.') } finally { setPhoneBusy(false) } }}>Verify number</button></>}
              </div>}
              {billingPhoneVerified && <small className="onboarding-verified">✓ Billing phone verified</small>}
            </label>

            <label>
              <span>Pocket Box SIM phone <i>{gatewayPreference === 'box' ? 'Optional for now' : 'Not required for App gateway'}</i></span>
              <span className="onboarding-input-wrap">
                <Smartphone size={18} />
                <input
                  type="tel"
                  name="boxSimPhone"
                  autoComplete="off"
                  inputMode="tel"
                  placeholder="01XXXXXXXXX"
                  value={form.boxSimPhone}
                  onChange={(event) => update('boxSimPhone', event.target.value)}
                  maxLength={24}
                  pattern="(?:\+?88)?01[3-9][0-9]{8}"
                  title="Enter the Bangladesh mobile number of the SIM installed in your Pocket Box."
                  required={false}
                  disabled={saving || loadingProfile || gatewayPreference === 'app'}
                />
              </span>
              <small className="onboarding-hint">{gatewayPreference === 'app' ? 'No hardware SIM is needed to start with the free Android gateway.' : 'You can add the SIM number now or later when your Box is ready.'}</small>
            </label>

            <button className="onboarding-submit" type="submit" disabled={saving || loadingProfile}>
              {saving ? <><Loader2 size={18} className="onboarding-spinner" /> Saving your setup…</> : <>Complete setup <ArrowRight size={18} /></>}
            </button>
            <p className="onboarding-footnote">Your API secret and wallet options become available after setup is saved.</p>
          </form>
        </section>
      </div>
    </main>
  )
}
