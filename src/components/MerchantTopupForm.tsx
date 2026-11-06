import { useState, type FormEvent } from 'react'

type Gateway = 'bKash' | 'Nagad' | 'Rocket' | 'Upay'

const MINIMUM_VOICE_MINUTES = 100
const PRICE_PER_MINUTE_BDT = 6.5

export default function MerchantTopupForm({ billingPhone = '', billingPhoneVerified = false }: { billingPhone?: string; billingPhoneVerified?: boolean }) {
  const [gateway, setGateway] = useState<Gateway>('bKash')
  const [trxId, setTrxId] = useState('')
  const [minutes, setMinutes] = useState(String(MINIMUM_VOICE_MINUTES))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const selectedMinutes = Number(minutes)
  const validMinutes = Number.isInteger(selectedMinutes) && selectedMinutes >= MINIMUM_VOICE_MINUTES
  const totalCost = validMinutes ? selectedMinutes * PRICE_PER_MINUTE_BDT : 0

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validMinutes) {
      setMessage(`Choose at least ${MINIMUM_VOICE_MINUTES} voice minutes.`)
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/merchant/topup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ gateway, trx_id: trxId.trim(), amount: totalCost, sender_phone: billingPhone }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Could not submit top-up.')
      setMessage('Top-up submitted. KashNode will match the payment notification automatically.')
      setTrxId('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit top-up.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="md-card md-topup-form" onSubmit={submit}>
      <strong>Automated wallet top-up</strong>
      <p className="md-muted">Send Money from your verified billing number, then enter the transfer details below.</p>
      <div className="md-topup-grid">
        <label className="md-topup-field">
          <span>Sender phone</span>
          <input type="tel" value={billingPhone} readOnly placeholder="Verify your billing phone in Settings" required />
        </label>
        <label className="md-topup-field">
          <span>MFS gateway</span>
          <select value={gateway} onChange={event => setGateway(event.target.value as Gateway)}>
            <option>bKash</option><option>Nagad</option><option>Rocket</option><option>Upay</option>
          </select>
        </label>
        <label className="md-topup-field">
          <span>Voice minutes</span>
          <input type="number" min={MINIMUM_VOICE_MINUTES} step="1" required value={minutes} onChange={event => setMinutes(event.target.value)} aria-describedby="md-topup-price" />
        </label>
        <label className="md-topup-field">
          <span>Transaction ID</span>
          <input required minLength={5} maxLength={40} value={trxId} onChange={event => setTrxId(event.target.value.toUpperCase())} placeholder="Enter Send Money TrxID" />
        </label>
      </div>
      <div className="md-topup-price" id="md-topup-price" aria-live="polite">
        <span>Top-up total</span>
        <strong>{validMinutes ? `৳${totalCost.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Enter at least 100 minutes'}</strong>
        <small>৳{PRICE_PER_MINUTE_BDT.toFixed(2)} per minute · minimum {MINIMUM_VOICE_MINUTES} minutes</small>
      </div>
      <button className="md-primary" type="submit" disabled={busy || !trxId.trim() || !billingPhone || !billingPhoneVerified || !validMinutes}>{busy ? 'Submitting…' : 'Submit for automatic matching'}</button>
      {!billingPhoneVerified && <p className="md-muted">Verify your primary billing number in Settings → Billing &amp; MFS before submitting a top-up.</p>}
      {message && <p className="md-muted" role="status">{message}</p>}
    </form>
  )
}
