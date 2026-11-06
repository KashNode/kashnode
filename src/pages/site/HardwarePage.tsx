import { ArrowRight, Check, Radio, RefreshCw, Smartphone, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'

const OPTIONS = [
  {
    icon: Smartphone, name: 'Option A — Android Dual-SIM Agent', label: 'Use a supported Android phone',
    description: 'An Android agent app runs as a persistent foreground service and listens for incoming transaction SMS. Assign each SIM slot to a payment service, choose the outbound SMS SIM, and keep events buffered locally when the internet is unavailable.',
    points: ['Explicit SIM 1 / SIM 2 payment-service mapping', 'Select the SIM used for outgoing customer SMS', 'Local SQLite queue for offline capture and later sync', 'Persistent service notification for operational visibility'],
  },
  {
    icon: Radio, name: 'Option B — ESP32 cellular node', label: 'Dedicated standalone hardware',
    description: 'A LilyGO / TTGO T-Call style board uses its own cellular connection to send captured transaction data to the central service. It is designed for merchants who prefer a dedicated device instead of an Android phone.',
    points: ['SIM-based cellular data; no Wi-Fi or PC required', 'SMS capture and outbound confirmation through the node SIM', '5V power from a charger or power bank', 'Custom C++ firmware with OTA update support'],
  },
]

export default function HardwarePage() {
  return (
    <SiteLayout title="Transaction Ingestion Devices">
      <section className="site-page-hero site-hero-dark">
        <div className="site-wrap">
          <Eyebrow>Hardware & device agents</Eyebrow>
          <h1>Two ways to connect <em>your payment SIM.</em></h1>
          <p className="site-lede">Choose a software agent on an Android dual-SIM phone or a standalone ESP32 cellular board. Both options capture transaction notifications and forward them to the central platform for verification.</p>
          <div className="site-dual-cta">
            <a href="#device-options" className="site-btn site-btn-primary site-btn-lg">Compare device options <ArrowRight size={17} /></a>
            <Link to="/contact" className="site-btn site-btn-outline-light site-btn-lg">Discuss deployment</Link>
          </div>
        </div>
      </section>
      <section className="site-section" id="device-options">
        <div className="site-wrap">
          <Eyebrow>Device choices</Eyebrow>
          <h2 className="site-h2">Select the deployment that fits your operation.</h2>
          <div className="site-eco-cards">
            {OPTIONS.map(option => {
              const Icon = option.icon
              return (
                <article key={option.name}>
                  <span className="site-card-icon"><Icon size={21} /></span>
                  <p className="site-plan-tag">{option.label}</p>
                  <h3>{option.name}</h3>
                  <p>{option.description}</p>
                  <ul className="site-check-list">{option.points.map(point => <li key={point}><Check size={15} />{point}</li>)}</ul>
                </article>
              )
            })}
          </div>
        </div>
      </section>
      <section className="site-section site-section-light">
        <div className="site-wrap site-split">
          <div>
            <Eyebrow>Resilient ingestion</Eyebrow>
            <h2 className="site-h2">Capture first. Synchronise when connected.</h2>
            <p className="site-body">The Android option stores incoming messages in a local SQLite buffer during temporary network loss and synchronises them when connectivity returns. The ESP32 option connects over its own cellular data link and can receive firmware updates over the air.</p>
            <ul className="site-check-list">
              <li><Wifi size={15} /> Cellular connectivity for the standalone node</li>
              <li><RefreshCw size={15} /> Offline queue and later sync on Android</li>
              <li><Check size={15} /> Server-side matching uses transaction references</li>
            </ul>
          </div>
          <div className="site-card">
            <span className="site-card-icon"><Radio size={20} /></span>
            <h3>Important deployment note</h3>
            <p>Device support depends on the selected hardware, SIM/operator behaviour and Android permissions. Confirm the target device and carrier before deployment; do not assume every phone model supports reliable background SMS capture.</p>
          </div>
        </div>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}
