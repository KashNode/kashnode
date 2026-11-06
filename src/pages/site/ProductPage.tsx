import { Link } from 'react-router-dom'
import { ArrowRight, Box, LayoutDashboard, PhoneCall, ShieldCheck, Truck, Wallet, Workflow } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'
import { DashboardMock } from '../../components/site/SiteVisuals'

const ARCHITECTURE = [
  { icon: LayoutDashboard, title: 'Merchant dashboard', text: 'Live status for Kash AI, your Box, your store connection, today’s orders and remaining minutes — one screen that shows whether the system is actually working.' },
  { icon: Workflow, title: 'Order automation', text: 'Orders flow in from WooCommerce, Shopify or a custom store and move through verification, payment matching and courier booking without manual steps.' },
  { icon: ShieldCheck, title: 'Customer verification', text: 'COD orders are verified by SMS from your business SIM, proving a real customer before anything ships.' },
  { icon: Wallet, title: 'Payment verification', text: 'bKash, Nagad, Rocket and Upay payments are checked by verification code and TrxID, so paid and unpaid are never confused.' },
  { icon: PhoneCall, title: 'AI voice automation', text: 'Kash calls customers in natural Bangla to confirm orders and follow up — and merchants can switch the voice between male and female.' },
  { icon: Truck, title: 'Courier workflow', text: 'Confirmed orders are booked with Steadfast or Pathao automatically, with tracking and delivery status in the same place.' },
  { icon: Box, title: 'Device connectivity', text: 'The KashNode Box keeps your business SIM connected to the platform around the clock, with signal, balance and sync visible in the dashboard.' },
]

export default function ProductPage() {
  return (
    <SiteLayout title="Product — The KashNode Platform">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Product</Eyebrow>
          <h1>One ecosystem. <em>Three parts, working together.</em></h1>
          <p className="site-lede">The KashNode Platform is the software, Kash AI is the voice, and the KashNode Box is the hardware. Each part does its own job — together they run your store operations.</p>
          <div className="site-eco-cards">
            <article><strong>KashNode Platform</strong><p>The merchant platform: orders, verification, payments, courier and business workflows.</p><Link to="/features">Explore the platform <ArrowRight size={15} /></Link></article>
            <article><strong>Kash AI</strong><p>The voice assistant that talks with your customers and automates routine calls.</p><Link to="/kash-ai">Meet Kash AI <ArrowRight size={15} /></Link></article>
            <article><strong>KashNode Box</strong><p>The device that connects your business SIM to the platform, day and night.</p><Link to="/hardware">See the Box <ArrowRight size={15} /></Link></article>
          </div>
        </div>
      </section>

      <section className="site-section site-section-light">
        <div className="site-wrap">
          <Eyebrow>Architecture</Eyebrow>
          <h2 className="site-h2">How the pieces connect.</h2>
          <div className="site-arch">
            <div className="site-arch-flow">
              <span>Your store</span><ArrowRight size={16} />
              <span>KashNode Platform</span><ArrowRight size={16} />
              <span>Kash AI + Box</span><ArrowRight size={16} />
              <span>Customer &amp; courier</span>
            </div>
            <p className="site-body">An order arrives from your store. The platform verifies the customer and the payment, Kash confirms the order by voice, and the courier is booked — all in one connected flow.</p>
          </div>
          <div className="site-ledger">
            {ARCHITECTURE.map((item, index) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="site-ledger-row">
                  <span className="site-ledger-num">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <span className="site-card-icon"><Icon size={20} /></span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-split">
          <div>
            <Eyebrow>Merchant dashboard</Eyebrow>
            <h2 className="site-h2">See whether the system is actually working.</h2>
            <p className="site-body">Home shows live status for Kash AI, your Box and your store. Orders shows verification results. Calls shows Kash’s conversations. Box shows your SIM. Wallet shows your package, remaining minutes and overage.</p>
            <Link to="/login" className="site-btn site-btn-primary">Open the dashboard <ArrowRight size={16} /></Link>
          </div>
          <DashboardMock />
        </div>
      </section>

      <FinalCta />
    </SiteLayout>
  )
}
