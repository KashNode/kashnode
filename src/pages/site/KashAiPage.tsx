import { Link } from 'react-router-dom'
import { ArrowRight, Check, Mic, PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'
import { CallHistoryVisual, CallInterface } from '../../components/site/SiteVisuals'

const FLOW = [
  { icon: PhoneIncoming, title: 'Kash calls the customer', text: 'After an order is placed, Kash calls the customer in a natural Bangla voice — no human dialling, no missed calls.' },
  { icon: Mic, title: 'A real conversation', text: 'Kash confirms the order, answers routine questions, and understands the customer’s reply in Bangla.' },
  { icon: Check, title: 'Confirmed or flagged', text: 'Confirmed orders move to fulfilment. Unclear answers are flagged in the dashboard for your team to review.' },
  { icon: PhoneOutgoing, title: 'Follow-ups, automatically', text: 'Unanswered calls and unpaid orders get a follow-up call — on a schedule you control, not on your team’s memory.' },
]

export default function KashAiPage() {
  return (
    <SiteLayout title="Kash AI — The Voice of Your Store">
      <section className="site-page-hero site-hero-dark">
        <div className="site-wrap">
          <Eyebrow>Kash AI</Eyebrow>
          <h1>Your store, <em>with a voice.</em></h1>
          <p className="site-lede">Kash is the AI voice assistant inside KashNode. It talks with your customers, confirms orders, and handles routine calls — in natural Bangla, around the clock, without a human on the line.</p>
          <div className="site-dual-cta">
            <Link to="/login" className="site-btn site-btn-primary site-btn-lg">Try Kash AI free <ArrowRight size={17} /></Link>
            <Link to="/features" className="site-btn site-btn-outline-light site-btn-lg">See all features <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-split">
          <CallInterface />
          <div>
            <Eyebrow>A real call</Eyebrow>
            <h2 className="site-h2">What a Kash call sounds like.</h2>
            <p className="site-body">Kash greets the customer by name, confirms the order details, and closes the call clearly. The customer hears your store’s voice — not a robot reading a script, and not a stranger calling from a personal number.</p>
            <ul className="site-check-list">
              <li>Natural Bangla conversation</li>
              <li>Male or female voice — your choice</li>
              <li>Every call logged with a summary</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="site-section site-section-light">
        <div className="site-wrap">
          <Eyebrow>Conversation flow</Eyebrow>
          <h2 className="site-h2">From order to confirmed — automatically.</h2>
          <div className="site-steps">
            {FLOW.map((step, index) => {
              const Icon = step.icon
              return (
                <article key={step.title}>
                  <span className="site-steps-num">{String(index + 1).padStart(2, '0')}</span>
                  <span className="site-card-icon"><Icon size={20} /></span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-split">
          <div>
            <Eyebrow>Connected to your workflow</Eyebrow>
            <h2 className="site-h2">Kash works with the rest of KashNode.</h2>
            <p className="site-body">Calls are not a separate tool. Kash knows the order, the payment status and the courier state — so a confirmation call, a payment follow-up and a delivery update all come from the same place. Failed calls raise an alert in the dashboard, and you can change the voice or the call rules from your merchant settings.</p>
            <p className="site-body">Voice usage is measured in AI minutes. Every package includes a minute bundle, and extra minutes are a flat ৳7 per minute.</p>
          </div>
          <CallHistoryVisual />
        </div>
      </section>

      <FinalCta />
    </SiteLayout>
  )
}
