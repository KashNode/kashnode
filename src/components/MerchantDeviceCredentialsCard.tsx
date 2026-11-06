import { useState } from 'react'
import { Copy, Eye, EyeOff, KeyRound } from 'lucide-react'

export default function MerchantDeviceCredentialsCard({ merchantId, secret, loading, error, onNotify }: {
  merchantId: string
  secret: string
  loading: boolean
  error: string
  onNotify: (message: string) => void
}) {
  const [visible, setVisible] = useState(false)
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); onNotify(`${label} copied.`) }
    catch { onNotify('Clipboard access is unavailable in this browser.') }
  }
  return <article className="md-card md-merchant-secret-card">
    <div className="md-card-top"><strong><KeyRound size={17} /> Device &amp; API pairing</strong><span className="md-badge">Private</span></div>
    <p className="md-muted">Available on every merchant plan. Use these credentials to pair Kash AI Android App, KashNode Box, or authenticate your server integration. Keep the secret private.</p>
    {error && <p className="md-error" role="alert">{error}</p>}
    <label className="md-integration-field"><span>Merchant ID</span><code className="md-secret-value">{loading ? 'Loading…' : merchantId || 'Not available'}</code></label>
    <div className="md-secret-actions"><button type="button" className="md-secondary" disabled={loading || !merchantId} onClick={() => void copy(merchantId, 'Merchant ID')}><Copy size={15}/> Copy ID</button></div>
    <label className="md-integration-field"><span>Merchant Secret / Pairing Token</span><code className="md-secret-value">{loading ? 'Loading secure key…' : visible ? secret : secret ? '••••••••••••' + secret.slice(-4) : 'Not available'}</code></label>
    <div className="md-secret-actions">
      <button type="button" className="md-secondary" disabled={loading || !secret} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={15}/> : <Eye size={15}/>} {visible ? 'Hide secret' : 'Show secret'}</button>
      <button type="button" className="md-secondary" disabled={loading || !secret} onClick={() => void copy(secret, 'Merchant secret')}><Copy size={15}/> Copy secret</button>
    </div>
  </article>
}
