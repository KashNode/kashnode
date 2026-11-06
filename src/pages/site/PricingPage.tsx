import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { Faq, FinalCta } from '../../components/site/SiteSections'

type Cell = string
type PlanRow = { feature: string; basic: Cell; standard: Cell; premium: Cell }

const ISP_ROWS: PlanRow[] = [
  { feature: 'MikroTik routers', basic: '1 router', standard: 'Up to 3 routers', premium: 'Unlimited' },
  { feature: 'Customer capacity', basic: 'Up to 500', standard: 'Up to 2,000', premium: 'Unlimited' },
  { feature: 'Automatic line restore', basic: 'TrxID / number match', standard: 'TrxID / number match', premium: 'TrxID / number match' },
  { feature: 'Notifications', basic: 'SMS', standard: 'SMS + WhatsApp text', premium: 'SMS + WhatsApp + email' },
  { feature: 'Invoices', basic: 'Basic receipt', standard: 'Digital summary', premium: 'Dynamic PDF invoice' },
  { feature: 'Automatic reminders', basic: '—', standard: '3 days before expiry', premium: '3 days + 1 day before expiry, with bot' },
  { feature: 'Staff collection portal', basic: '—', standard: '—', premium: 'Cash collection portal' },
  { feature: 'Monthly transaction quota', basic: '500', standard: '2,500', premium: 'Unlimited' },
]

const STORE_ROWS: PlanRow[] = [
  { feature: 'Website connections', basic: '1 website', standard: 'Up to 3 websites', premium: 'Unlimited' },
  { feature: 'Payment verification', basic: 'Manual TrxID entry', standard: 'Zero-input auto matching', premium: 'Zero-input + TrxID fallback' },
  { feature: 'Customer identity', basic: 'SMS OTP', standard: 'WhatsApp-first OTP', premium: 'WhatsApp + email OTP' },
  { feature: 'Checkout', basic: 'Standard payment page', standard: 'Branded checkout', premium: 'White-label + live socket' },
  { feature: 'Order status', basic: 'Automatic Paid mark', standard: 'Automatic Paid mark', premium: 'Instant Paid + full fulfilment' },
  { feature: 'Invoice delivery', basic: 'SMS', standard: 'WhatsApp / email text', premium: 'Branded PDF on WhatsApp' },
  { feature: 'Merchant alerts', basic: 'Dashboard only', standard: 'Telegram notification', premium: 'WhatsApp + Telegram bot' },
  { feature: 'Monthly transaction quota', basic: '300', standard: '1,500', premium: 'Unlimited' },
]

function PlanMatrix({ title, intro, rows }: { title: string; intro: string; rows: PlanRow[] }) {
  return (
    <section className="site-section">
      <div className="site-wrap">
        <Eyebrow>30-day renewable licence</Eyebrow>
        <h2 className="site-h2">{title}</h2>
        <p className="site-body">{intro}</p>
        <div className="site-compare" role="region" aria-label={title} tabIndex={0}>
          <table>
            <thead><tr><th scope="col">Capability</th><th scope="col">Basic</th><th scope="col">Standard</th><th scope="col">Premium</th></tr></thead>
            <tbody>{rows.map(row => (
              <tr key={row.feature}>
                <th scope="row">{row.feature}</th>
                <td>{row.basic}</td>
                <td><strong>{row.standard}</strong></td>
                <td>{row.premium}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="site-note"><Check size={14} /> Package limits and features follow the platform architecture specification. Prices are not published in that specification.</p>
      </div>
    </section>
  )
}

const FAQS = [
  { q: 'Are ISP and e-commerce plans the same?', a: 'No. The platform defines separate plan matrices. ISP plans are sized by routers, customer capacity and monthly transactions. E-commerce plans are sized by website connections and monthly transactions.' },
  { q: 'How long does a licence last?', a: 'Each merchant licence is renewable every 30 days.' },
  { q: 'What payment methods are in scope?', a: 'The architecture names bKash, Nagad, Rocket and Upay. Payment receipts are captured and matched against transaction references.' },
  { q: 'Are prices listed here?', a: 'The architecture blueprint defines plan limits and included capabilities, but it does not specify subscription prices. Contact the team for a current commercial quote.' },
]

export default function PricingPage() {
  return (
    <SiteLayout title="Plans & Licensing">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Plans & licensing</Eyebrow>
          <h1>One platform. <em>Plans shaped around your business.</em></h1>
          <p className="site-lede">Choose the plan family that matches your operation: internet service provider or e-commerce. Every licence renews on a 30-day cycle.</p>
          <div className="site-dual-cta">
            <a href="#isp-plans" className="site-btn site-btn-primary site-btn-lg">ISP plans <ArrowRight size={16} /></a>
            <a href="#store-plans" className="site-btn site-btn-outline-dark site-btn-lg">E-commerce plans <ArrowRight size={16} /></a>
          </div>
        </div>
      </section>
      <div id="isp-plans"><PlanMatrix title="For ISP businesses" intro="Built around MikroTik RouterOS v7, subscriber capacity, automatic line restoration and recurring bill collection." rows={ISP_ROWS} /></div>
      <div id="store-plans"><PlanMatrix title="For e-commerce businesses" intro="Built around store connections, customer verification, payment matching and order-status automation." rows={STORE_ROWS} /></div>
      <section className="site-section site-section-light">
        <div className="site-wrap site-faq-wrap">
          <Eyebrow>Licensing questions</Eyebrow>
          <h2 className="site-h2">Clear limits. Predictable renewals.</h2>
          <Faq items={FAQS} />
          <p className="site-note">For a quote or help choosing a plan, <Link to="/contact">contact the team</Link>.</p>
        </div>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}
