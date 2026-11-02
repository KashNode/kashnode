import { useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, Search, Truck } from 'lucide-react'
import { trackOrder, type OrderTrackingResult } from '../lib/kashApi'

export function CourierTrackingWidget() {
  const [orderId, setOrderId] = useState('')
  const [courier, setCourier] = useState<'steadfast' | 'redx' | 'pathao'>('steadfast')
  const [result, setResult] = useState<OrderTrackingResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)
    try { setResult(await trackOrder(orderId.trim(), courier)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not check this order.') }
    finally { setLoading(false) }
  }

  return <section className="panel courier-tracking-panel" aria-labelledby="courier-tracking-title">
    <div className="panel-heading"><div><span className="eyebrow">DELIVERY OPERATIONS</span><h2 id="courier-tracking-title">Courier order tracking</h2></div><span className="courier-track-icon"><Truck size={18} /></span></div>
    <form className="courier-track-form" onSubmit={submit}>
      <div className="courier-track-fields">
        <label className="courier-track-order"><span className="field-label">Order or tracking ID</span><input className="text-field" value={orderId} onChange={event => setOrderId(event.target.value)} placeholder="e.g. KN-9842" minLength={2} maxLength={80} required /></label>
        <label><span className="field-label">Courier partner</span><select className="text-field" value={courier} onChange={event => setCourier(event.target.value as typeof courier)}><option value="steadfast">Steadfast</option><option value="redx">RedX</option><option value="pathao">Pathao</option></select></label>
        <button className="primary-button courier-track-submit" type="submit" disabled={loading}>{loading ? <LoaderCircle size={15} className="refresh-spinning" /> : <Search size={15} />}{loading ? 'Checking…' : 'Track order'}</button>
      </div>
    </form>
    {error && <div className="courier-track-message error" role="alert"><AlertCircle size={16} />{error}</div>}
    {result && <div className="courier-track-result" role="status"><div className="courier-result-top"><span><CheckCircle2 size={17} /><strong>{result.status}</strong></span><span className={`courier-source ${result.source}`}>{result.source === 'mock' ? 'DEMO' : 'LIVE'}</span></div><div className="courier-result-meta"><span>Order <strong>{result.orderId}</strong></span><span>{result.courier}</span>{result.deliveryCharge !== null && <span>Delivery ৳{result.deliveryCharge}</span>}</div><p>{result.note}</p></div>}
  </section>
}
