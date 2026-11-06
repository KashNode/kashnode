import { ArrowRight, Box, Check, Clock, Mic, PhoneCall, ShieldCheck, Signal, Truck, Wallet } from 'lucide-react'

/** Product UI previews use clearly labelled sample data — they illustrate the interface, not real merchant figures. */
export function PreviewTag() {
  return <span className="site-preview-tag">Product preview · sample data</span>
}

export function DashboardMock() {
  return (
    <div className="site-dash" aria-label="KashNode merchant dashboard preview">
      <PreviewTag />
      <div className="site-dash-side">
        <span className="site-dash-logo">KN</span>
        <span className="active">Dashboard</span>
        <span>Orders</span>
        <span>Verification</span>
        <span>Kash AI</span>
        <span>Courier</span>
      </div>
      <div className="site-dash-main">
        <div className="site-dash-head">
          <div>
            <strong>Good morning, your store</strong>
            <small>Automation is running smoothly</small>
          </div>
          <span className="site-dash-today">Today</span>
        </div>
        <div className="site-dash-stats">
          <div><small>Verified orders</small><strong>12</strong><span>Confirmed by Kash AI</span></div>
          <div><small>Payments matched</small><strong>9</strong><span>bKash · Nagad · Rocket</span></div>
          <div><small>Parcels booked</small><strong>8</strong><span>Steadfast · Pathao</span></div>
        </div>
        <svg className="site-dash-chart" viewBox="0 0 520 120" aria-hidden="true">
          <defs>
            <linearGradient id="site-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4de5bd" stopOpacity=".35" />
              <stop offset="1" stopColor="#4de5bd" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 96 C 60 88, 90 60, 140 66 S 230 40, 290 52 S 400 20, 460 30 L 520 14 L 520 120 L 0 120 Z" fill="url(#site-chart-fill)" />
          <path d="M0 96 C 60 88, 90 60, 140 66 S 230 40, 290 52 S 400 20, 460 30 L 520 14" fill="none" stroke="#4de5bd" strokeWidth="2.5" />
        </svg>
        <ul className="site-dash-orders">
          <li><ShieldCheck size={15} /> <span>Order #2481 — COD verified by SMS</span><b>Verified</b></li>
          <li><Wallet size={15} /> <span>Order #2480 — bKash TrxID matched</span><b>Paid</b></li>
          <li><Truck size={15} /> <span>Order #2479 — Steadfast parcel booked</span><b>Booked</b></li>
        </ul>
      </div>
    </div>
  )
}

export function BoxRender({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`site-box ${compact ? 'compact' : ''}`} aria-label="KashNode Box device render">
      <div className="site-box-antenna"><i /><i /></div>
      <div className="site-box-body">
        <div className="site-box-top">
          <span className="site-box-mark">KN</span>
          <span className="site-box-status"><i /> Online</span>
        </div>
        <p className="site-box-name">KashNode Box</p>
        <div className="site-box-leds"><i /><i /><i /><i /></div>
        <div className="site-box-signal"><Signal size={15} /> <span>4G LTE · Strong signal</span></div>
      </div>
      <div className="site-box-glow" aria-hidden="true" />
    </div>
  )
}

export function CallInterface() {
  return (
    <div className="site-call" aria-label="Kash AI voice call interface preview">
      <PreviewTag />
      <div className="site-call-head">
        <span className="site-call-avatar"><PhoneCall size={18} /></span>
        <div>
          <strong>Kash AI · Customer call</strong>
          <small>Order #2481 · Confirmation call</small>
        </div>
        <span className="site-call-live"><i /> Live</span>
      </div>
      <div className="site-call-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <ul className="site-call-script">
        <li className="ai"><span>Kash</span><p>Assalamu alaikum — I am calling from your store about order #2481. Could you please confirm your order?</p></li>
        <li className="customer"><span>Customer</span><p>Yes, I ordered a kurti. Please confirm it.</p></li>
        <li className="ai"><span>Kash</span><p>Thank you — your order is confirmed. Your parcel will be booked with the courier shortly.</p></li>
      </ul>
      <div className="site-call-foot">
        <span><Clock size={14} /> 1 min 42 sec</span>
        <span><Check size={14} /> Order confirmed</span>
        <span><Mic size={14} /> Bangla voice</span>
      </div>
    </div>
  )
}

export const WORKFLOW_STEPS = [
  { icon: Box, title: 'New order', text: 'A customer orders from your WooCommerce or Shopify store.' },
  { icon: ShieldCheck, title: 'Verify customer', text: 'Kash sends an SMS from your business SIM and confirms the customer is real.' },
  { icon: Wallet, title: 'Match payment', text: 'Mobile payments are matched automatically by verification code and TrxID.' },
  { icon: PhoneCall, title: 'AI confirmation call', text: 'Kash calls the customer in a natural voice to confirm or follow up.' },
  { icon: Truck, title: 'Book courier', text: 'Confirmed orders are pushed to Steadfast or Pathao for delivery.' },
]

export function WorkflowSteps() {
  return (
    <ol className="site-flow">
      {WORKFLOW_STEPS.map((step, index) => {
        const Icon = step.icon
        return (
          <li key={step.title}>
            <span className="site-flow-num">{String(index + 1).padStart(2, '0')}</span>
            <span className="site-flow-icon"><Icon size={20} /></span>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
            {index < WORKFLOW_STEPS.length - 1 && <ArrowRight className="site-flow-arrow" size={18} />}
          </li>
        )
      })}
    </ol>
  )
}
