import { useEffect, useState } from 'react'
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

type Plan = {
  slug: string; name: string; tagline: string; price_per_minute: number | string; currency: string;
  billing_unit: string; short_features: string[]; details: string[]; display_order: number;
}
const FALLBACK_PLANS: Plan[] = []

export function PricingTiers({ compact = false }: { compact?: boolean }) {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS)
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [gateways, setGateways] = useState<Record<string, 'app' | 'box'>>({})
  useEffect(() => {
    let active = true
    fetch('/api/plans', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async response => {
        const payload = await response.json()
        if (!response.ok || payload.source !== 'database' || !Array.isArray(payload.plans)) throw new Error(payload.message || 'Package catalog is unavailable.')
        if (active) { setPlans(payload.plans); setCatalogError('') }
      })
      .catch(error => { if (active) setCatalogError(error instanceof Error ? error.message : 'Package catalog is unavailable.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const visiblePlans = (compact ? plans.filter(plan => plan.slug !== 'free') : plans)
  if (loading) return <div className="site-note" role="status">Loading package details…</div>
  if (catalogError || !plans.length) return <div className="site-note" role="alert">{catalogError || 'Package information is temporarily unavailable. Please contact our team.'}</div>
  return (
    <div className="site-plans">
      {visiblePlans.map(plan => {
        const gateway = gateways[plan.slug] || 'app'
        const price = Number(plan.price_per_minute).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const features = Array.isArray(plan.short_features) ? plan.short_features : []
        const details = Array.isArray(plan.details) ? plan.details : []
        return (
          <article key={plan.slug} className={`site-plan ${plan.slug === 'standard' ? 'popular' : ''}`}>
            {plan.slug === 'standard' && <span className="site-plan-badge">Most Popular</span>}
            <p className="site-plan-tag">{plan.tagline}</p>
            <h3>{plan.name}</h3>
            <p className="site-plan-price">৳{price} <span>{plan.billing_unit === 'minute' ? '/minute' : plan.billing_unit}</span></p>
            <p className="site-plan-allowance">{plan.slug === 'free' ? '10 complimentary AI minutes' : 'Pay only for voice time used'}</p>
            <ul>{features.map(feature => <li key={feature}><Check size={15} /> {feature}</li>)}</ul>
            {details.length > 0 && <details className="site-plan-details"><summary>See details</summary><ul>{details.map(detail => <li key={detail}><Check size={14} /> {detail}</li>)}</ul></details>}
            {plan.slug !== 'free' && <fieldset className="site-gateway-picker">
              <legend>Choose your gateway</legend>
              <label className={gateway === 'app' ? 'selected' : ''}>
                <input type="radio" name={`gateway-${plan.slug}`} value="app" checked={gateway === 'app'} onChange={() => setGateways(current => ({ ...current, [plan.slug]: 'app' }))} />
                <Smartphone size={18} /><span><strong>Start with Kash AI App</strong><small>Free Android gateway · no hardware required</small></span>
              </label>
              <label className={gateway === 'box' ? 'selected' : ''}>
                <input type="radio" name={`gateway-${plan.slug}`} value="box" checked={gateway === 'box'} onChange={() => setGateways(current => ({ ...current, [plan.slug]: 'box' }))} />
                <Box size={18} /><span><strong>Add KashNode Box</strong><small>৳8,000 one-time hardware purchase</small></span>
              </label>
            </fieldset>}
            <Link to={plan.slug === 'free' ? '/signup?plan=free' : `/signup?plan=${plan.slug}&gateway=${gateway}`} className={`site-btn ${plan.slug === 'standard' ? 'site-btn-primary' : `site-btn-plan-${plan.slug}`} site-btn-block`}>
              {plan.slug === 'free' ? 'Start Free Trial' : `Choose ${plan.name}`} <ArrowRight size={16} />
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
