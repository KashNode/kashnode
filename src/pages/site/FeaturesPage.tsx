import { Link } from 'react-router-dom'
import { ArrowRight, LayoutDashboard, PhoneCall, ShieldCheck, Truck, Wallet, Workflow } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'
import { CallInterface, DashboardMock } from '../../components/site/SiteVisuals'

const FEATURES = [
  {
    icon: ShieldCheck, title: 'Order Verification', text: 'Every order is checked before it ships. COD customers receive a verification SMS from your business SIM and confirm with a code — proving a real customer with a real phone number, and stopping fake orders at the door.',
    points: ['SMS verification from your own business SIM', 'Fake and fraud orders blocked before dispatch', 'Failed verifications flagged for review'],
  },
  {
    icon: Wallet, title: 'Payment Verification', text: 'Mobile payments are matched automatically. KashNode checks the verification code and TrxID against the order, so you can tell at a glance which orders are paid, which are unmatched, and which need a human check.',
    points: ['bKash, Nagad, Rocket and Upay', 'TrxID matched / unmatched states', 'Review queue for anything unclear'],
  },
  {
    icon: PhoneCall, title: 'Kash AI Customer Calls', text: 'Kash calls your customers in a natural Bangla voice to confirm orders, follow up on payments, and handle routine conversations — without a human on the line. You can switch the voice between male and female.',
    points: ['Natural Bangla voice calls', 'Confirmation and follow-up calls', 'Call history with summaries'],
  },
  {
    icon: Truck, title: 'Courier Automation', text: 'Once an order is verified and paid, KashNode books the parcel with Steadfast or Pathao automatically. Tracking and delivery status stay in the same dashboard as the order.',
    points: ['Automatic parcel booking', 'Steadfast and Pathao', 'Delivery status in one place'],
  },
  {
    icon: LayoutDashboard, title: 'Merchant Dashboard', text: 'Home, Orders, Calls, Box and Wallet — the dashboard shows live status for Kash AI, your Box and your store, today’s verified orders, and how many minutes you have left.',
    points: ['Live system status', 'Orders, calls and Box in one place', 'Minutes and package at a glance'],
  },
  {
    icon: Workflow, title: 'Business Automation', text: 'The pieces work as one flow: store → verification → payment → AI call → courier. Routine work happens on its own, and your team only steps in where a human decision is needed.',
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
          <p className="site-lede">Six capabilities, one flow — from the moment an order arrives to the moment the courier picks it up.</p>
        </div>
      </section>

      {FEATURES.map((feature, index) => {
        const Icon = feature.icon
        const visual = index === 2 ? <CallInterface /> : index === 4 ? <DashboardMock /> : null
        return (
          <section key={feature.title} className={`site-section ${index % 2 === 0 ? 'site-section-light' : ''}`}>
            <div className="site-wrap site-split">
              <div>
                <span className="site-card-icon"><Icon size={20} /></span>
                <h2 className="site-h2">{feature.title}</h2>
                <p className="site-body">{feature.text}</p>
                <ul className="site-check-list">
                  {feature.points.map(point => <li key={point}>{point}</li>)}
                </ul>
              </div>
              {visual ?? (
                <div className="site-feature-visual">
                  <span className="site-feature-visual-icon"><Icon size={40} /></span>
                  <strong>{feature.title}</strong>
                  <p>Live in your merchant dashboard.</p>
                </div>
              )}
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
