import { Link } from 'react-router-dom'
import { ArrowRight, LayoutDashboard, PhoneCall, ShieldCheck, Truck, Wallet, Workflow } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'
import { CallInterface, DashboardMock, FeatureVisual } from '../../components/site/SiteVisuals'

const FEATURES: { icon: typeof ShieldCheck; title: string; text: string; points: string[]; visual: 'verify' | 'payment' | 'call' | 'courier' | 'dashboard' | 'automation' }[] = [
  {
    icon: ShieldCheck, title: 'Order Verification', visual: 'verify', text: 'Every order is checked before it ships. COD customers receive a verification SMS from your business SIM and confirm with a code — proving a real customer with a real phone number, and stopping fake orders at the door.',
    points: ['SMS verification from your own business SIM', 'Fake and fraud orders blocked before dispatch', 'Failed verifications flagged for review'],
  },
  {
    icon: Wallet, title: 'Payment Verification', visual: 'payment', text: 'Mobile payments are matched automatically. KashNode checks the verification code and TrxID against the order, so you can tell at a glance which orders are paid, which are unmatched, and which need a human check.',
    points: ['bKash, Nagad, Rocket and Upay', 'TrxID matched / unmatched states', 'Review queue for anything unclear'],
  },
  {
    icon: PhoneCall, title: 'Kash AI Customer Calls', visual: 'call', text: 'Kash calls your customers in a natural Bangla voice to confirm orders, follow up on payments, and handle routine conversations — without a human on the line. You can switch the voice between male and female.',
    points: ['Natural Bangla voice calls', 'Confirmation and follow-up calls', 'Call history with summaries'],
  },
  {
    icon: Truck, title: 'Courier & Fulfilment Handoff', visual: 'courier', text: 'KashNode keeps order verification and fulfilment operations in one workflow. Live courier booking and tracking are not generally available yet; provider credentials and a production API adapter are required.',
    points: ['Verified orders prepared for fulfilment', 'Courier provider setup required', 'Live booking and tracking availability to be confirmed'],
  },
  {
    icon: LayoutDashboard, title: 'Merchant Dashboard', visual: 'dashboard', text: 'Home, Orders, Calls, Box and Wallet — the dashboard shows live status for Kash AI, your Box and your store, today’s verified orders, and how many minutes you have left.',
    points: ['Live system status', 'Orders, calls and Box in one place', 'Minutes and package at a glance'],
  },
  {
    icon: Workflow, title: 'Business Automation', visual: 'automation', text: 'The pieces work as one flow: store → verification → payment → AI call → courier. Routine work happens on its own, and your team only steps in where a human decision is needed.',
    points: ['One connected workflow', 'Alerts for Box offline, low minutes, failed calls', 'Voice and settings you control'],
  },
]

export default function FeaturesPage() {
  return (
    <SiteLayout title="Features">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Features</Eyebrow>
          <h1>Everything your store needs to run <em>without the manual work.</em></h1>
          <p className="site-lede">Connected capabilities for the work between order arrival and fulfilment. Provider-dependent actions are clearly identified before onboarding.</p>
        </div>
      </section>

      {FEATURES.map((feature, index) => {
        const Icon = feature.icon
        const visual = feature.visual === 'call' ? <CallInterface /> : feature.visual === 'dashboard' ? <DashboardMock /> : <FeatureVisual kind={feature.visual} />
        return (
          <section key={feature.title} className={`site-section ${index % 2 === 0 ? 'site-section-light' : ''}`}>
            <div className={`site-wrap site-split ${index % 2 === 1 ? 'flip' : ''}`}>
              <div>
                <span className="site-card-icon"><Icon size={20} /></span>
                <h2 className="site-h2">{feature.title}</h2>
                <p className="site-body">{feature.text}</p>
                <ul className="site-check-list">
                  {feature.points.map(point => <li key={point}>{point}</li>)}
                </ul>
              </div>
              {visual}
            </div>
          </section>
        )
      })}

      <section className="site-section">
        <div className="site-wrap site-center-block">
          <h2 className="site-h2">See all of it in your dashboard.</h2>
          <p className="site-body">Create a free workspace and explore the platform — or talk to us about the KashNode Box.</p>
          <div className="site-dual-cta">
            <Link to="/login" className="site-btn site-btn-primary site-btn-lg">Create Free Workspace <ArrowRight size={17} /></Link>
            <Link to="/hardware" className="site-btn site-btn-outline-dark site-btn-lg">Explore KashNode Box <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>

      <FinalCta />
    </SiteLayout>
  )
}
