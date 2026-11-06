import { useEffect, useState } from 'react'

export default function BillingPhoneSettings({ phone = '', verified = false }: { phone?: string; verified?: boolean }) {
  const [value, setValue] = useState(phone)
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [isVerified, setIsVerified] = useState(verified)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { setValue(phone); setIsVerified(verified) }, [phone, verified])

  async function post(path: string, body: unknown) {
    const response = await fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.message || 'Request failed.')
    return payload
  }

  async function sendCode() {
    setBusy(true); setMessage('')
    try { await post('/api/merchant/billing-phone/otp', { phone: value }); setSent(true); setIsVerified(false); setMessage('Verification code sent.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not send code.') }
    finally { setBusy(false) }
  }

  async function verify() {
    setBusy(true); setMessage('')
    try { const result = await post('/api/merchant/billing-phone/verify', { code }); setValue(result.billingPhone); setIsVerified(true); setSent(false); setMessage('Billing phone verified.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Verification failed.') }
    finally { setBusy(false) }
  }

  return <div className="md-card">
    <div className="md-card-top"><strong>Billing MFS number</strong><span className={`md-badge ${isVerified ? 'ok' : 'warn'}`}>{isVerified ? 'Verified' : 'Verification required'}</span></div>
    <p className="md-muted">Use this bKash, Nagad or Rocket number to Send Money for wallet top-ups.</p>
    <label className="md-field-label">Primary number<input type="tel" value={value} onChange={event => { setValue(event.target.value); setIsVerified(false); setSent(false) }} placeholder="01XXXXXXXXX" disabled={busy || isVerified} /></label>
    {!isVerified && <button className="md-secondary" type="button" disabled={busy || !value.trim()} onClick={() => void sendCode()}>{sent ? 'Resend OTP' : 'Send 6-digit OTP'}</button>}
    {sent && !isVerified && <><label className="md-field-label">OTP<input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="6-digit code" /></label><button className="md-primary" type="button" disabled={busy || code.length !== 6} onClick={() => void verify()}>Verify number</button></>}
    {message && <p className="md-muted" role="status">{message}</p>}
  </div>
}
