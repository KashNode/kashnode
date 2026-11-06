import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle, Network, ShoppingBag, Smartphone, Wallet } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'

const GROUPS = [
  {
    icon: ShoppingBag, title: 'Store & order workflows',
    items: [
      ['Merchant order records', 'Orders are managed in the KashNode platform. Specific store-platform connectors must be confirmed before onboarding.'],
      ['Store API / webhook connection', 'Integration availability depends on the deployed connector and merchant configuration; do not assume every store platform is live.'],
    ],
  },
  {
    icon: Wallet, title: 'Payment signals',
    items: [
      ['Connected SIM / SMS ingestion', 'Device-connected SMS events can be ingested by the platform. Supported message formats and merchant setup must be verified.'],
      ['Payment matching', 'Payment matching availability depends on the configured message format and a verified end-to-end workflow.'],
    ],
  },
  {
    icon: MessageCircle, title: 'AI voice services',
    items: [
      ['Speech recognition', 'The voice runtime uses a configured speech-to-text provider; service credentials are required.'],
      ['Language model', 'OpenAI, Gemini or Groq can be selected in the server-side voice prompt service when configured.'],
      ['Bangla text-to-speech', 'Google Cloud Text-to-Speech is used by the documented Bangla voice runtime and requires service credentials.'],
    ],
  },
  {
    icon: Network, title: 'Courier & fulfilment',
    items: [
      ['Courier provider adapters', 'Live courier booking and tracking are not generally available. Provider credentials and production API adapters must be configured; tracking currently returns a demo response until then.'],
    ],
  },
  {
    icon: Smartphone, title: 'Connected devices',
    items: [
      ['KashNode Box', 'A connected merchant device can report SIM and network telemetry to the authenticated platform API. Device pairing and secure configuration are required.'],
    ],
  },
]

export default function IntegrationsPage() {
  return (
    <SiteLayout title="E-commerce Connections">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>E-commerce connections</Eyebrow>
          <h1>Connect the workflows behind <em>every order.</em></h1>
          <p className="site-lede">KashNode connects order operations, payment signals, AI voice and device workflows. Availability depends on the production connector, credentials and merchant setup; this page distinguishes documented capabilities from provider-dependent work.</p>
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
                    <span className="site-badge planned">Setup / validation required</span>
                  </article>
                ))}
              </section>
            )
          })}
          <p className="site-note">Provider names and workflows are not presented as generally available unless they have passed production validation. Courier booking and tracking remain provider-dependent and currently return demo tracking responses until adapters and credentials are configured.</p>
        </div>
      </section>
      <section className="site-section">
        <div className="site-wrap site-center-block">
          <h2 className="site-h2">Need help planning your connection?</h2>
          <p className="site-body">Tell us about your online store and the operational workflow you want to automate. We can confirm which connections are currently supported and what setup is required.</p>
          <Link to="/contact" className="site-btn site-btn-primary">Talk to the team <ArrowRight size={16} /></Link>
        </div>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}
