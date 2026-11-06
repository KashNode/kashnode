import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, FileText, HelpCircle, Megaphone, PlayCircle, LifeBuoy } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { Faq, FinalCta } from '../../components/site/SiteSections'

const GUIDES = [
  { icon: BookOpen, title: 'Getting started', text: 'Create a workspace, connect your store, and verify your first order with Kash.' },
  { icon: FileText, title: 'Connect WooCommerce', text: 'Install the plugin, link your store, and let orders flow into KashNode.' },
  { icon: FileText, title: 'Connect Shopify', text: 'Connect your Shopify store and start automating confirmation for every order.' },
  { icon: PlayCircle, title: 'Your first Kash call', text: 'What happens on a Kash confirmation call, and how to read the call summary.' },
  { icon: BookOpen, title: 'KashNode Box setup', text: 'Plug in the Box, insert your business SIM, and connect it to your workspace.' },
  { icon: BookOpen, title: 'Minutes & packages', text: 'How order and minute bundles work, and what happens when minutes run out.' },
]

const FAQS = [
  { q: 'How do I start with KashNode?', a: 'Create a free workspace from the sign-in page, connect your store, and verify your first order. The Free Trial includes 10 orders and 10 AI minutes.' },
  { q: 'Where do I see whether the system is working?', a: 'Your merchant dashboard shows live status for Kash AI, your Box and your store, plus today’s orders, calls and remaining minutes.' },
  { q: 'How do I change the AI voice?', a: 'In your merchant dashboard, open Alerts & Settings and switch the Kash voice between male and female.' },
  { q: 'What if a verification fails?', a: 'Failed verifications appear in the review queue in your dashboard, so your team can check them and decide what happens next.' },
]

export default function ResourcesPage() {
  return (
    <SiteLayout title="Resources">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Resources</Eyebrow>
          <h1>Everything you need to run <em>KashNode well.</em></h1>
          <p className="site-lede">Guides, help, documentation and answers — all in one place.</p>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <Eyebrow>Guides</Eyebrow>
          <h2 className="site-h2">Learn by doing.</h2>
          <div className="site-ledger">
            {GUIDES.map((item, index) => {
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
          <p className="site-note">Full documentation and tutorials are being written as the platform grows. These guides cover what KashNode does today.</p>
        </div>
      </section>

      <section className="site-section site-section-light">
        <div className="site-wrap site-split">
          <div>
            <Eyebrow>Help Center</Eyebrow>
            <h2 className="site-h2">Stuck? Start here.</h2>
            <p className="site-body">The Help Center answers the most common questions about setup, verification, calls, minutes and the Box. If you need a human, contact us and we will help.</p>
            <Link to="/contact" className="site-btn site-btn-primary">Contact support <ArrowRight size={16} /></Link>
          </div>
          <article className="site-card">
            <span className="site-card-icon"><LifeBuoy size={20} /></span>
            <h3>Documentation</h3>
            <p>Developer documentation for store plugins and the KashNode API is in progress. For now, the guides above cover setup and daily use.</p>
            <span className="site-badge planned">In progress</span>
          </article>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-split">
          <div>
            <Eyebrow>Product updates</Eyebrow>
            <h2 className="site-h2">What’s new in KashNode.</h2>
            <p className="site-body">Recent work includes the premium merchant dashboard with desktop mode, a readable System light theme, and voice-billing safeguards for Kash calls.</p>
            <span className="site-badge"><Megaphone size={13} /> Latest: merchant dashboard v2</span>
          </div>
          <div className="site-faq-wrap">
            <h3 className="site-h3"><HelpCircle size={18} /> Frequently asked questions</h3>
            <Faq items={FAQS} />
          </div>
        </div>
      </section>

      <FinalCta />
    </SiteLayout>
  )
}
