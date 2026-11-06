import { useState, type FormEvent } from 'react'

type Gateway = 'bKash' | 'Nagad' | 'Rocket' | 'Upay'

export default function MerchantTopupForm({ billingPhone = '', billingPhoneVerified = false, ratePerMinute, minimumMinutes }: { billingPhone?: string; billingPhoneVerified?: boolean; ratePerMinute: number | null; minimumMinutes: number | null }) {
  const [gateway, setGateway] = useState<Gateway>('bKash')
  const [trxId, setTrxId] = useState('')
  const [minutes, setMinutes] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const selectedMinutes = Number(minutes)
  const minimum = minimumMinutes ?? 0
  const validRate = ratePerMinute !== null && Number.isFinite(ratePerMinute) && ratePerMinute >= 0
  const validMinutes = Number.isSafeInteger(selectedMinutes) && minimum > 0 && selectedMinutes >= minimum
  const totalCost = validMinutes && validRate ? selectedMinutes * (ratePerMinute as number) : null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validMinutes || totalCost === null || !validRate) {
      setMessage('The active plan pricing is unavailable or the selected minutes are below its configured minimum.')
      return
    }
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/merchant/wallet/topup', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ gateway, trx_id: trxId.trim(), minutes: selectedMinutes, sender_phone: billingPhone }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Could not submit top-up.')
      setMessage('Top-up submitted. KashNode will match the payment notification automatically.')
      setTrxId(''); setMinutes('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit top-up.')
    } finally { setBusy(false) }
  }

  return (
    <form className="md-card md-topup-form" onSubmit={submit}>
      <strong>Wallet top-up</strong>
      <p className="md-muted">Your amount is calculated using the active plan rate and independently recalculated by the server.</p>
      <div className="md-topup-grid">
        <label className="md-topup-field"><span>Sender phone</span><input type="tel" value={billingPhone} readOnly placeholder="Verify your billing phone in Settings" required /></label>
        <label className="md-topup-field"><span>MFS gateway</span><select value={gateway} onChange={event => setGateway(event.target.value as Gateway)}><option>bKash</option><option>Nagad</option><option>Rocket</option><option>Upay</option></select></label>
        <label className="md-topup-field"><span>Voice minutes</span><input type="number" min={minimum > 0 ? minimum : undefined} step="1" required value={minutes} onChange={event => setMinutes(event.target.value)} aria-describedby="md-topup-price" disabled={!validRate || minimum <= 0} /></label>
        <label className="md-topup-field"><span>Transaction ID</span><input required minLength={5} maxLength={40} value={trxId} onChange={event => setTrxId(event.target.value.toUpperCase())} placeholder="Enter Send Money TrxID" /></label>
      </div>
      <div className="md-topup-price" id="md-topup-price" aria-live="polite">
        <span>Total payable</span>
        <strong>{totalCost === null ? 'Pricing unavailable' : `৳${totalCost.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong>
        <small>{validRate ? `৳${(ratePerMinute as number).toFixed(2)} per minute · minimum ${minimum} minutes` : 'Plan pricing is not configured'}</small>
      </div>
      <button className="md-primary" type="submit" disabled={busy || !trxId.trim() || !billingPhone || !billingPhoneVerified || !validMinutes || totalCost === null}>{busy ? 'Submitting…' : 'Submit top-up'}</button>
      {!billingPhoneVerified && <p className="md-muted">Verify your primary billing number in Settings → Billing &amp; MFS before submitting a top-up.</p>}
      {message && <p className="md-muted" role="status">{message}</p>}
    </form>
  )
}
