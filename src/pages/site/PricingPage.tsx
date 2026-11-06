import { Link } from 'react-router-dom'
import { ArrowRight, Box, Check, Smartphone } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { Faq, FinalCta, OverageNote, PricingTiers } from '../../components/site/SiteSections'

const COMPARISON: { feature: string; free: string; basic: string; standard: string; premium: string }[] = [
  { feature: 'Orders included', free: '10 / month', basic: '300 / month', standard: '1,000 / month', premium: '3,000 / month' },
  { feature: 'AI voice minutes', free: '10 minutes', basic: '300 minutes', standard: '1,000 minutes', premium: '3,000 minutes' },
  { feature: 'Order & payment verification', free: 'Yes', basic: 'Yes', standard: 'Yes', premium: 'Yes' },
  { feature: 'Kash AI customer calls', free: 'Yes', basic: 'Yes', standard: 'Yes', premium: 'Yes' },
  { feature: 'Courier booking', free: '—', basic: 'Yes', standard: 'Yes', premium: 'Yes' },
  { feature: 'Merchant voice rules', free: '—', basic: '—', standard: 'Yes', premium: 'Yes' },
  { feature: 'Conversation history', free: '—', basic: '—', standard: 'Yes', premium: 'Yes' },
  { feature: 'Multi-box operations', free: '—', basic: '—', standard: '—', premium: 'Yes' },
  { feature: 'Support', free: 'Standard', basic: 'Standard', standard: 'Priority workflow', premium: 'Priority support' },
]

const FAQS = [
  { q: 'How do the packages work?', a: 'Each monthly package is sized by orders and includes an AI minute bundle — for example, Basic is 300 orders and 300 minutes for ৳2,000 a month. You pay for the package, not per call.' },
  { q: 'What happens when my minutes run out?', a: 'Extra AI minutes are a flat ৳7 per minute, topped up from inside the app. Your package renews monthly with a fresh order and minute bundle.' },
  { q: 'Is the KashNode Box included in a plan?', a: 'No. Plans cover the platform and AI minutes. The Box is a one-time hardware purchase — request availability on the hardware page for current pricing.' },
  { q: 'Can I start for free?', a: 'Yes. The Free Trial is ৳0 and includes 10 orders and 10 AI minutes, so you can verify real orders with Kash before choosing a plan.' },
]

export default function PricingPage() {
  return (
    <SiteLayout title="Pricing">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Pricing</Eyebrow>
          <h1>Simple, predictable pricing <em>for every stage.</em></h1>
          <p className="site-lede">Pick your gateway, then pick your package. Every plan is monthly, sized by orders, with AI minutes included.</p>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <Eyebrow>Step 1 — Your gateway</Eyebrow>
          <h2 className="site-h2">Start with the app, or add the Box.</h2>
          <div className="site-path-cards site-path-cards-wide">
            <article>
              <span className="site-path-icon"><Smartphone size={20} /></span>
              <h3>Kash AI App</h3>
              <p className="site-plan-price">৳0 <span>to start</span></p>
              <p>Turn any Android phone into your automation gateway instantly. Explore the platform and verify real orders.</p>
              <ul className="site-check-list">
                <li>No hardware needed</li>
                <li>Set up in minutes</li>
                <li>Same platform, same dashboard</li>
              </ul>
              <Link to="/login" className="site-btn site-btn-primary">Start Free <ArrowRight size={16} /></Link>
            </article>
            <article className="box">
              <span className="site-path-icon"><Box size={20} /></span>
              <h3>KashNode Box</h3>
              <p className="site-plan-price">One-time fee <span>· request availability</span></p>
              <p>Dedicated plug-and-play hardware for your business SIM, built for 24/7 reliability.</p>
              <ul className="site-check-list">
                <li>Continuous power, no battery</li>
                <li>Industrial 4G/LTE stability</li>
                <li>Instant SMS &amp; voice routing</li>
              </ul>
              <Link to="/hardware" className="site-btn site-btn-dark">Explore KashNode Box <ArrowRight size={16} /></Link>
            </article>
          </div>
        </div>
      </section>

      <section className="site-section site-section-light">
        <div className="site-wrap">
          <Eyebrow>Step 2 — Your package</Eyebrow>
          <h2 className="site-h2">Monthly packages, minutes included.</h2>
          <PricingTiers />
          <OverageNote />
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <Eyebrow>Compare plans</Eyebrow>
          <h2 className="site-h2">What each plan includes.</h2>
          <div className="site-compare">
            <table>
              <thead><tr><th></th><th>Free Trial</th><th>Basic</th><th>Standard</th><th>Premium</th></tr></thead>
              <tbody>
                {COMPARISON.map(row => (
                  <tr key={row.feature}>
                    <td>{row.feature}</td>
                    <td>{row.free}</td>
                    <td>{row.basic}</td>
                    <td><strong>{row.standard}</strong></td>
                    <td>{row.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="site-note"><Check size={14} /> Prices shown are the published KashNode packages. The Box is priced separately on inquiry.</p>
        </div>
      </section>

      <section className="site-section site-section-light">
        <div className="site-wrap site-faq-wrap">
          <Eyebrow>Pricing questions</Eyebrow>
          <h2 className="site-h2">Questions, answered.</h2>
          <Faq items={FAQS} />
        </div>
      </section>

      <FinalCta />
    </SiteLayout>
  )
}
