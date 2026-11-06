import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown, Smartphone, Box } from 'lucide-react'
import { BoxRender } from './SiteVisuals'

export type FaqItem = { q: string; a: string }

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState(0)
  return (
    <div className="site-faq">
      {items.map((item, index) => (
        <div key={item.q} className={`site-faq-item ${open === index ? 'open' : ''}`}>
          <button type="button" onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}>
            <span>{item.q}</span>
            <ChevronDown size={18} />
          </button>
          {open === index && <p>{item.a}</p>}
        </div>
      ))}
    </div>
  )
}

export const PLANS = [
  {
    id: 'free', name: 'Free Trial', tag: 'Try it first', price: '৳0', per: 'trial', usage: '10 complimentary AI minutes',
    features: ['Order verification by SMS', 'AI confirmation calls', 'Payment code verification', 'Merchant dashboard'],
    details: ['Explore the core KashNode workflow before choosing a paid package.'],
    cta: 'Start Free Trial',
  },
  {
    id: 'basic', name: 'Basic', tag: 'Essential automation', price: '৳5.50', per: '/minute', usage: 'Pay only for voice time used',
    features: ['AI voice order verification', 'One gateway: Android app or Basic Box', 'Standard male or female AI voice', '7-day call logs and status'],
    details: ['Manual support through email or support ticket.', 'Designed for stores that need reliable, essential order verification.'],
    cta: 'Choose Basic',
  },
  {
    id: 'standard', name: 'Standard', tag: 'More control for growing stores', price: '৳6.50', per: '/minute', usage: 'Pay only for voice time used',
    popular: true,
    features: ['Advanced AI voice verification', 'Up to 2 devices / SIMs with failover', 'bKash & Nagad payment SMS matching', 'Steadfast or Pathao courier booking'],
    details: ['Faster, more natural AI responses.', 'Automatic TrxID matching from supported payment messages.', '30-day call and payment history.', 'Priority chat support.'],
    cta: 'Choose Standard',
  },
  {
    id: 'premium', name: 'Premium', tag: 'Advanced business automation', price: '৳7.00', per: '/minute', usage: 'Pay only for voice time used',
    features: ['Ultra-realistic AI voice with custom tone', 'Smart retry and dynamic scheduling', 'Unlimited multi-device / Box management', 'Advanced fraud and fake-order detection'],
    details: ['Automatic blocklist for suspicious activity.', 'Full API and webhook access.', 'Dedicated account manager and VIP phone support.'],
    cta: 'Choose Premium',
  },
]

export function PricingTiers({ compact = false }: { compact?: boolean }) {
  const plans = compact ? PLANS.slice(1) : PLANS
  const [gateways, setGateways] = useState<Record<string, 'app' | 'box'>>({})
  return (
    <div className="site-plans">
      {plans.map(plan => {
        const gateway = gateways[plan.id] || 'app'
        return (
          <article key={plan.id} className={`site-plan ${plan.popular ? 'popular' : ''}`}>
            {plan.popular && <span className="site-plan-badge">Most Popular</span>}
            <p className="site-plan-tag">{plan.tag}</p>
            <h3>{plan.name}</h3>
            <p className="site-plan-price">{plan.price} <span>{plan.per}</span></p>
            <p className="site-plan-allowance">{plan.usage}</p>
            <ul>{plan.features.map(feature => <li key={feature}><Check size={15} /> {feature}</li>)}</ul>
            <details className="site-plan-details">
              <summary>See details</summary>
              <ul>{plan.details.map(detail => <li key={detail}><Check size={14} /> {detail}</li>)}</ul>
            </details>
            <fieldset className="site-gateway-picker">
              <legend>Choose your gateway</legend>
              <label className={gateway === 'app' ? 'selected' : ''}>
                <input type="radio" name={`gateway-${plan.id}`} value="app" checked={gateway === 'app'} onChange={() => setGateways(current => ({ ...current, [plan.id]: 'app' }))} />
                <Smartphone size={18} /><span><strong>Start with Kash AI App</strong><small>Free Android gateway · no hardware required</small></span>
              </label>
              <label className={gateway === 'box' ? 'selected' : ''}>
                <input type="radio" name={`gateway-${plan.id}`} value="box" checked={gateway === 'box'} onChange={() => setGateways(current => ({ ...current, [plan.id]: 'box' }))} />
                <Box size={18} /><span><strong>Add KashNode Box</strong><small>৳8,000 one-time hardware purchase</small></span>
              </label>
            </fieldset>
            <Link to={`/signup?plan=${plan.id}&gateway=${gateway}`} className={`site-btn ${plan.popular ? 'site-btn-primary' : `site-btn-plan-${plan.id}`} site-btn-block`}>
              {plan.cta} <ArrowRight size={16} />
            </Link>
          </article>
        )
      })}
    </div>
  )
}

export function OverageNote() {
  return <p className="site-overage">AI voice usage is billed by actual call duration at your selected plan rate. There are no monthly subscriptions or per-order charges. The KashNode Box is a separate one-time hardware purchase at ৳8,000 — <Link to="/hardware">view Box details</Link>.</p>
}

/** Avoid displaying unverified provider logos or names as live integrations. */
export function IntegrationStrip() {
  return <p className="site-note">Provider availability is confirmed during onboarding. Courier booking and tracking require a configured production adapter.</p>
}

export function FinalCta() {
  return (
    <section className="site-final-cta">
      <div className="site-final-cta-split">
        <BoxRender compact />
        <div className="site-final-cta-copy">
          <h2>Ready to automate your store?</h2>
          <p>Start with the Platform today, or get the KashNode Box for ৳8,000 (one-time) and full automation with your business SIM.</p>
          <div className="site-dual-cta">
            <Link to="/login" className="site-btn site-btn-primary site-btn-lg">Create Your Workspace <ArrowRight size={17} /></Link>
            <Link to="/hardware" className="site-btn site-btn-outline-light site-btn-lg">Explore KashNode Box <ArrowRight size={17} /></Link>
          </div>
          <p className="site-final-cta-note">Quick setup · Secure &amp; reliable · Local &amp; online support</p>
        </div>
      </div>
    </section>
  )
}
