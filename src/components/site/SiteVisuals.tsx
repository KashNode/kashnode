import { ArrowDown, ArrowRight, Box, Check, Clock, LayoutDashboard, Mic, PhoneCall, ShieldCheck, Truck, Wallet } from 'lucide-react'

/** Product UI previews use clearly labelled sample data — they illustrate the interface, not real merchant figures. */
export function PreviewTag() {
  return <span className="site-preview-tag">Product preview · sample data</span>
}

export function DashboardMock() {
  return (
    <div className="site-laptop" aria-label="KashNode merchant dashboard preview">
      <div className="site-laptop-screen">
    <div className="site-dash">
      <PreviewTag />
      <div className="site-dash-side">
        <span className="site-dash-logo">KN</span>
        <span className="active">Dashboard</span>
        <span>Verification</span>
        <span>Payments</span>
        <span>Kash AI</span>
        <span>Courier</span>
        <span>Reports</span>
      </div>
      <div className="site-dash-main">
        <div className="site-dash-head">
          <div>
            <strong>Good morning, Your Store</strong>
            <small>Automation is running smoothly</small>
          </div>
        </div>
        <div className="site-dash-stats">
          <div><small>Verified orders</small><strong>12</strong><span>Confirmed by Kash</span></div>
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
          <li><ShieldCheck size={15} /> <span>Order #2481 · COD verified</span><b>Verified</b></li>
          <li><Wallet size={15} /> <span>Order #2480 · bKash matched</span><b>Paid</b></li>
        </ul>
      </div>
    </div>
      </div>
      <div className="site-laptop-base" aria-hidden="true" />
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
        <div className="site-box-signal"><span>Signal · 4G LTE</span><span className="site-box-signal-bars" aria-hidden="true"><i /><i /><i /><i /></span></div>
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

/** Small CSS-only product panels used on the Features page — sample data is labelled. */
export function FeatureVisual({ kind }: { kind: 'verify' | 'payment' | 'courier' | 'automation' }) {
  return (
    <div className="site-feature-visual" aria-label="Feature preview">
      <PreviewTag />
      {kind === 'verify' && (
        <div className="site-mini">
          <div className="site-mini-row"><ShieldCheck size={18} /><span><b>SMS verification</b> — Order #2481</span><span className="site-mini-tag ok">Verified</span></div>
          <div className="site-mini-row"><span>Your code</span><span className="site-mini-code" aria-hidden="true"><i>4</i><i>8</i><i>2</i><i>9</i></span><span className="site-mini-tag ok">Matched</span></div>
          <p className="site-mini-note">Sent from your business SIM — the customer confirms with the code.</p>
        </div>
      )}
      {kind === 'payment' && (
        <div className="site-mini">
          <div className="site-mini-row"><Wallet size={18} /><span><b>bKash</b> · TrxID 9HX7…K2</span><span className="site-mini-tag ok">Matched</span></div>
          <div className="site-mini-row"><Wallet size={18} /><span><b>Nagad</b> · TrxID 8JK2…M9</span><span className="site-mini-tag ok">Matched</span></div>
          <div className="site-mini-row"><Wallet size={18} /><span><b>Rocket</b> · TrxID not found</span><span className="site-mini-tag warn">Review</span></div>
          <p className="site-mini-note">Paid, unmatched and unclear payments are never confused.</p>
        </div>
      )}
      {kind === 'courier' && (
        <div className="site-mini">
          <div className="site-mini-row"><Truck size={18} /><span><b>Steadfast</b> · Parcel #SF-2481</span><span className="site-mini-tag ok">Booked</span></div>
          <div className="site-mini-row"><Truck size={18} /><span><b>Pathao</b> · Parcel #PT-1180</span><span className="site-mini-tag ok">Booked</span></div>
          <p className="site-mini-note">Verified orders are booked automatically — tracking stays with the order.</p>
        </div>
      )}
      {kind === 'automation' && (
        <div className="site-mini">
          <div className="site-mini-flow"><span>Store</span><ArrowRight size={16} /><span>Verify</span><ArrowRight size={16} /><span>Call</span><ArrowRight size={16} /><span>Courier</span></div>
          <div className="site-mini-row"><Check size={18} /><span>Routine work runs on its own — <b>your team steps in only where a human decision is needed.</b></span></div>
          <p className="site-mini-note">One connected workflow, from order to delivery.</p>
        </div>
      )}
    </div>
  )
}

export function CallHistoryVisual() {
  return (
    <div className="site-feature-visual" aria-label="Kash AI call history preview">
      <PreviewTag />
      <div className="site-mini">
        <div className="site-mini-row"><PhoneCall size={18} /><span><b>Order #2481</b> — confirmed by Kash</span><small>1m 42s</small></div>
        <div className="site-mini-row"><PhoneCall size={18} /><span><b>Order #2480</b> — confirmed by Kash</span><small>1m 05s</small></div>
        <div className="site-mini-row"><PhoneCall size={18} /><span><b>Order #2477</b> — no answer</span><span className="site-mini-tag warn">Follow-up</span></div>
        <p className="site-mini-note">Every call is logged with its outcome, duration and a short summary.</p>
      </div>
    </div>
  )
}

export function EcosystemVisual() {
  return (
    <div className="site-feature-visual" aria-label="KashNode ecosystem">
      <div className="site-eco-visual">
        <div className="site-eco-node"><span className="site-card-icon"><LayoutDashboard size={20} /></span><div><strong>KashNode Platform</strong><span>The software — orders, verification, payments, courier.</span></div></div>
        <span className="site-eco-arrow"><ArrowDown size={18} /></span>
        <div className="site-eco-node"><span className="site-card-icon"><PhoneCall size={20} /></span><div><strong>Kash AI</strong><span>The voice — Bangla confirmation calls, around the clock.</span></div></div>
        <span className="site-eco-arrow"><ArrowDown size={18} /></span>
        <div className="site-eco-node"><span className="site-card-icon"><Box size={20} /></span><div><strong>KashNode Box</strong><span>The hardware — your business SIM, always connected.</span></div></div>
      </div>
    </div>
  )
}
