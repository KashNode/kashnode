import { Link } from 'react-router-dom'
import { ArrowRight, Cpu, MessageCircle, Network, ShoppingBag, Smartphone, Wallet } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'

const GROUPS = [
  {
    icon: ShoppingBag, title: 'Store platforms',
    items: [
      ['WooCommerce', 'Order and payment-status synchronisation through store hooks.'],
      ['Shopify', 'Order and payment-status synchronisation through store hooks.'],
      ['Laravel / custom commerce', 'Custom website connection through the platform webhook/API layer.'],
    ],
  },
  {
    icon: Wallet, title: 'Mobile financial services',
    items: [
      ['bKash', 'Incoming transaction SMS and TrxID matching.'],
      ['Nagad', 'Incoming transaction SMS and TrxID matching.'],
      ['Rocket', 'Incoming transaction SMS and TrxID matching.'],
      ['Upay', 'Incoming transaction SMS and TrxID matching.'],
    ],
  },
  {
    icon: Network, title: 'ISP infrastructure',
    items: [
      ['MikroTik RouterOS v7', 'Router API connection for subscriber status and automatic line restoration after verified payment.'],
    ],
  },
  {
    icon: MessageCircle, title: 'Messaging & notifications',
    items: [
      ['WhatsApp (Baileys)', 'QR-linked merchant WhatsApp session for invoice and OTP delivery.'],
      ['SMS', 'Transaction alerts, customer confirmation and OTP delivery through a connected SIM.'],
      ['Email', 'Premium-tier notification and invoice delivery.'],
      ['Telegram', 'Merchant bot notifications in the e-commerce Standard and Premium tiers.'],
    ],
  },
  {
    icon: Smartphone, title: 'Transaction ingestion devices',
    items: [
      ['Android Dual-SIM Agent', 'Maps payment services to SIM slots, captures incoming SMS and buffers events locally while offline.'],
      ['ESP32 LilyGO / TTGO T-Call', 'Standalone cellular node with its own SIM data connection, SMS capture and remote firmware-update capability.'],
    ],
  },
  {
    icon: Cpu, title: 'Platform interfaces',
    items: [
      ['Hosted checkout', 'Customer payment page with live browser updates over WebSocket / server-sent events.'],
      ['Merchant dashboard', 'Configuration for payment methods, devices, licences, transactions and integrations.'],
      ['Webhook layer', 'Server-side event processing for connected commerce platforms.'],
    ],
  },
]

export default function IntegrationsPage() {
  return (
    <SiteLayout title="Integrations & Connectivity">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Integrations & connectivity</Eyebrow>
          <h1>Connect payments, <em>networks and stores.</em></h1>
          <p className="site-lede">The platform blueprint covers two business tracks—ISP billing and e-commerce payments—using connected transaction-ingestion devices, messaging channels and server-side integrations.</p>
        </div>
      </section>
      <section className="site-section">
        <div className="site-wrap">
          {GROUPS.map(group => {
            const Icon = group.icon
            return (
              <section className="site-int-dir" key={group.title}>
                <div className="site-int-dir-head"><span className="site-card-icon"><Icon size={20} /></span><h2>{group.title}</h2></div>
                {group.items.map(([name, desc]) => (
                  <article className="site-int-row" key={name}>
                    <strong>{name}</strong><p>{desc}</p>
                    <span className="site-badge planned">Architecture scope</span>
                  </article>
                ))}
              </section>
            )
          })}
          <p className="site-note">“Architecture scope” describes components named in the technical blueprint; it is not a claim that every connector is already deployed or generally available.</p>
        </div>
      </section>
      <section className="site-section">
        <div className="site-wrap site-center-block">
          <h2 className="site-h2">Need help planning your connection?</h2>
          <p className="site-body">Tell us whether you operate an ISP, an online store or both. We can help map the required devices and integrations.</p>
          <Link to="/contact" className="site-btn site-btn-primary">Talk to the team <ArrowRight size={16} /></Link>
        </div>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}
