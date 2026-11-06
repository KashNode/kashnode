import { useState, type FormEvent } from 'react'

type Gateway = 'bKash' | 'Nagad' | 'Rocket' | 'Upay'

export default function MerchantTopupForm({ billingPhone = '', billingPhoneVerified = false }: { billingPhone?: string; billingPhoneVerified?: boolean }) {
  const [gateway, setGateway] = useState<Gateway>('bKash')
  const [trxId, setTrxId] = useState('')
  const [amount, setAmount] = useState('500')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/merchant/topup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ gateway, trx_id: trxId.trim(), amount: Number(amount), sender_phone: billingPhone }),
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
    <form className="md-card" onSubmit={submit}>
      <strong>Automated wallet top-up</strong>
      <p className="md-muted">Send Money from your verified billing number, then enter the transfer details below. Verify your number in Settings to enable top-ups.</p>
      <label className="md-field-label">Sender phone (verified billing number)
        <input type="tel" value={billingPhone} readOnly placeholder="Verify your billing phone in Settings first" required />
      </label>
      <label className="md-field-label">MFS gateway
        <select value={gateway} onChange={event => setGateway(event.target.value as Gateway)}>
          <option>bKash</option><option>Nagad</option><option>Rocket</option><option>Upay</option>
        </select>
      </label>
      <label className="md-field-label">Amount (BDT)
        <input type="number" min="1" max="1000000" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} />
      </label>
      <label className="md-field-label">Transaction ID
        <input required minLength={5} maxLength={40} value={trxId} onChange={event => setTrxId(event.target.value.toUpperCase())} placeholder="Enter Send Money TrxID" />
      </label>
      <button className="md-primary" type="submit" disabled={busy || !trxId.trim() || !billingPhone || !billingPhoneVerified}>{busy ? 'Submitting…' : 'Submit for automatic matching'}</button>
      {message && <p className="md-muted" role="status">{message}</p>}
    </form>
  )
}
