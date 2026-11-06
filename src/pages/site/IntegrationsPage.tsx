import { Link } from 'react-router-dom'
import { ArrowRight, CreditCard, ShoppingBag, Truck, Wrench } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'

type Status = 'Available' | 'Planned'
type Integration = { name: string; desc: string; status: Status }

const CATEGORIES: { icon: typeof ShoppingBag; title: string; items: Integration[] }[] = [
  {
    icon: ShoppingBag, title: 'E-commerce platforms',
    items: [
      { name: 'WooCommerce', desc: 'Orders sync into KashNode for verification, payment matching and courier booking.', status: 'Available' },
      { name: 'Shopify', desc: 'Connect your Shopify store and automate confirmation for every order.', status: 'Available' },
      { name: 'Custom stores', desc: 'A plugin and API for stores built on a custom stack.', status: 'Available' },
    ],
  },
  {
    icon: CreditCard, title: 'Mobile financial services',
    items: [
      { name: 'bKash', desc: 'Payments verified by code and TrxID against the order.', status: 'Available' },
      { name: 'Nagad', desc: 'Payments verified by code and TrxID against the order.', status: 'Available' },
      { name: 'Rocket', desc: 'Payments verified by code and TrxID against the order.', status: 'Available' },
      { name: 'Upay', desc: 'Payments verified by code and TrxID against the order.', status: 'Available' },
    ],
  },
  {
    icon: Truck, title: 'Courier services',
    items: [
      { name: 'Steadfast', desc: 'Automatic parcel booking for verified orders, with tracking in the dashboard.', status: 'Available' },
      { name: 'Pathao', desc: 'Automatic parcel booking for verified orders, with tracking in the dashboard.', status: 'Available' },
      { name: 'More couriers', desc: 'Additional courier partners are planned. Tell us which one you use.', status: 'Planned' },
    ],
  },
  {
    icon: Wrench, title: 'Business tools',
    items: [
      { name: 'KashNode Box', desc: 'Your business SIM, connected to the platform around the clock.', status: 'Available' },
      { name: 'More payment methods', desc: 'Additional payment options are planned as merchant demand grows.', status: 'Planned' },
      { name: 'More store platforms', desc: 'Additional e-commerce platforms are planned. Tell us which one you use.', status: 'Planned' },
    ],
  },
]

export default function IntegrationsPage() {
  return (
    <SiteLayout title="Integrations">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Integrations</Eyebrow>
          <h1>KashNode works with <em>the tools you already use.</em></h1>
          <p className="site-lede">Connect your store, your payments and your couriers — and keep everything in one workflow. Only integrations that are actually built are listed as available; everything else is clearly marked as planned.</p>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          {CATEGORIES.map(category => {
            const Icon = category.icon
            return (
              <div key={category.title} className="site-int-dir">
                <div className="site-int-dir-head">
                  <span className="site-card-icon"><Icon size={20} /></span>
                  <h3>{category.title}</h3>
                </div>
                {category.items.map(item => (
                  <div key={item.name} className="site-int-row">
                    <strong>{item.name}</strong>
                    <p>{item.desc}</p>
                    <span className={`site-badge ${item.status === 'Planned' ? 'planned' : ''}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-center-block">
          <h2 className="site-h2">Need an integration we don’t list yet?</h2>
          <p className="site-body">Tell us which platform, payment method or courier you use — planned integrations are prioritised by merchant demand.</p>
          <Link to="/contact" className="site-btn site-btn-primary">Request an integration <ArrowRight size={16} /></Link>
        </div>
      </section>

      <FinalCta />
    </SiteLayout>
  )
}
