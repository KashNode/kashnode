import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
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
    id: 'free', name: 'Free Trial', tag: 'Try it first', price: '৳0', per: 'free', orders: '10 orders', minutes: '10 AI minutes',
    features: ['Order verification by SMS', 'AI confirmation calls', 'Payment code verification', 'Merchant dashboard'],
    cta: 'Start Free Trial',
  },
  {
    id: 'basic', name: 'Basic', tag: 'For small stores', price: '৳2,000', per: '/month', orders: '300 orders', minutes: '300 AI minutes',
    features: ['Everything in Free Trial', 'COD confirmation workflows', 'Bangla AI voice calls', 'Merchant operations dashboard'],
    cta: 'Choose Basic',
  },
  {
    id: 'standard', name: 'Standard', tag: 'For growing businesses', price: '৳5,500', per: '/month', orders: '1,000 orders', minutes: '1,000 AI minutes',
    popular: true,
    features: ['Everything in Basic', 'Merchant voice rules', 'Conversation history & summaries', 'Priority support workflow'],
    cta: 'Choose Standard',
  },
  {
    id: 'premium', name: 'Premium', tag: 'For high-volume stores', price: '৳14,000', per: '/month', orders: '3,000 orders', minutes: '3,000 AI minutes',
    features: ['Everything in Standard', 'Priority support', 'Multi-box operations', 'Advanced reporting'],
    cta: 'Choose Premium',
  },
]

export function PricingTiers({ compact = false }: { compact?: boolean }) {
  const plans = compact ? PLANS.slice(1) : PLANS
  return (
    <div className="site-plans">
      {plans.map(plan => (
        <article key={plan.id} className={`site-plan ${plan.popular ? 'popular' : ''}`}>
          {plan.popular && <span className="site-plan-badge">Most Popular</span>}
          <p className="site-plan-tag">{plan.tag}</p>
          <h3>{plan.name}</h3>
          <p className="site-plan-price">{plan.price} <span>{plan.per}</span></p>
          <p className="site-plan-allowance">{plan.orders} · {plan.minutes}</p>
          <ul>
            {plan.features.map(feature => (
              <li key={feature}><Check size={15} /> {feature}</li>
            ))}
          </ul>
          <Link to={`/login?plan=${plan.id}`} className={`site-btn ${plan.popular ? 'site-btn-primary' : 'site-btn-outline-dark'} site-btn-block`}>
            {plan.cta} <ArrowRight size={16} />
          </Link>
        </article>
      ))}
    </div>
  )
}

export function OverageNote() {
  return <p className="site-overage">Every plan includes its order and minute bundle. Extra AI minutes are a flat <strong>৳7 per minute</strong> with in-app recharge. The KashNode Box is a one-time hardware purchase — <Link to="/hardware">request availability</Link> for current pricing.</p>
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
          <p>Start with the Platform today, or get the KashNode Box for full automation with your business SIM.</p>
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
