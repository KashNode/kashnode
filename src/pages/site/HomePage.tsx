import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Box, Check, CreditCard, LayoutDashboard, PhoneCall, ShieldCheck, Truck, Wallet } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { Faq, FinalCta, IntegrationStrip, OverageNote, PricingTiers } from '../../components/site/SiteSections'
import { BoxRender, CallInterface, DashboardMock, WorkflowSteps } from '../../components/site/SiteVisuals'

const HERO_STRIP = [
  { icon: ShieldCheck, title: 'Order Verification', text: 'Confirm real customers' },
  { icon: CreditCard, title: 'Payment Matching', text: 'Auto-match bKash, Nagad, Rocket' },
  { icon: PhoneCall, title: 'Kash AI Calls', text: 'Talk to customers automatically' },
  { icon: Truck, title: 'Courier Automation', text: 'Book & track parcels' },
  { icon: BarChart3, title: 'Higher Efficiency', text: 'Save time, reduce cost' },
]

const PILLARS = [
  { icon: PhoneCall, title: 'AI Voice Order Verification', text: 'Kash calls your customers in a natural Bangla voice to confirm orders — no human touch, no missed calls, no manual follow-ups.' },
  { icon: Wallet, title: 'Instant Payment Matching', text: 'Mobile payments are verified automatically by code and TrxID, so you know which orders are really paid before you dispatch.' },
  { icon: Truck, title: 'Automated Courier Dispatch', text: 'Only verified orders move to fulfilment. KashNode books parcels with Steadfast or Pathao and keeps the tracking in one place.' },
]

const OUTCOMES = [
  { title: 'Fewer fake orders', text: 'Every COD order is verified by SMS from your own business SIM before it ships, so fake and fraud orders are stopped at the door.' },
  { title: 'No more manual calling', text: 'Routine confirmation calls run on their own. Your team spends its time growing the business instead of chasing customers on the phone.' },
  { title: 'Faster dispatch', text: 'Verified orders go straight to the courier. Less waiting between order and delivery means happier customers.' },
  { title: 'One place to see it all', text: 'Orders, verifications, calls, minutes and your Box — the merchant dashboard shows whether the system is actually working.' },
]

const FAQS = [
  { q: 'How does KashNode verify a COD order?', a: 'When a customer places an order, KashNode sends a verification SMS from your business SIM in the KashNode Box. The customer confirms with the code, proving the order comes from a real person with a real phone number.' },
  { q: 'Do I need the KashNode Box to start?', a: 'No. You can start with the KashNode Platform — your merchant web dashboard — and explore it first. The Box is a dedicated device for merchants who want 24/7 reliability with their business SIM always connected.' },
  { q: 'Which stores and payments does KashNode work with?', a: 'WooCommerce, Shopify and custom stores, with payment verification for bKash, Nagad, Rocket and Upay, and courier booking with Steadfast and Pathao.' },
  { q: 'How does pricing work?', a: 'You choose a monthly package by orders, and each package includes an AI minute bundle — Free Trial is 10 orders and 10 minutes at ৳0. Extra AI minutes are a flat ৳7 per minute with in-app recharge.' },
  { q: 'Does Kash speak Bangla?', a: 'Yes. Kash talks with customers in Bangla on confirmation calls. The website and dashboard are in English.' },
]

export default function HomePage() {
  return (
    <SiteLayout title="AI Verification & Automation for Online Stores">
      <section className="site-hero">
        <div className="site-hero-glow" aria-hidden="true" />
        <div className="site-hero-inner">
          <div className="site-hero-copy">
            <span className="site-pill">All-in-One E-commerce Automation</span>
            <h1>Run your store operations<br /> without the daily <em>manual work.</em></h1>
            <p className="site-lede">Verify customers, match payment messages, automate routine calls with Kash AI, and move confirmed orders toward fulfilment — all from one connected platform.</p>
            <ul className="site-hero-checks">
              <li><Check size={16} /> Fewer fake orders</li>
              <li><Check size={16} /> Faster confirmation</li>
              <li><Check size={16} /> 24/7 automation</li>
            </ul>
            <div className="site-path-cards">
              <article>
                <span className="site-path-icon"><LayoutDashboard size={20} /></span>
                <h2>Start with KashNode Platform</h2>
                <p>Create your business workspace, explore the platform, and begin configuring your store.</p>
                <Link to="/login" className="site-btn site-btn-primary">Create Your Workspace <ArrowRight size={16} /></Link>
                <small>Get started in minutes. No hardware needed.</small>
              </article>
              <article className="box">
                <span className="site-path-icon"><Box size={20} /></span>
                <h2>Get the KashNode Box</h2>
                <p>Bring your business SIM into the ecosystem and activate device-connected automation.</p>
                {/* White glass card now: the readable button here is site-btn-dark. site-btn-outline-light would be white-on-white on this card — the earlier contrast fix (readable button) is preserved in intent. */}
                <Link to="/hardware" className="site-btn site-btn-dark">Explore KashNode Box <ArrowRight size={16} /></Link>
                <small>Full automation with your business SIM.</small>
              </article>
            </div>
            <p className="site-hero-signin">Already have an account? <Link to="/login">Sign in</Link></p>
          </div>
          <div className="site-hero-visual">
            <DashboardMock />
            <div className="site-hero-box"><BoxRender compact /></div>
          </div>
        </div>
      </section>

      <section className="site-hero-strip" aria-label="What KashNode does">
        <div className="site-wrap site-hero-strip-inner">
          {HERO_STRIP.map(item => {
            const Icon = item.icon
            return (
              <div key={item.title} className="site-hero-strip-item">
                <span className="site-hero-strip-icon"><Icon size={20} /></span>
                <div><strong>{item.title}</strong><span>{item.text}</span></div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="site-section site-section-light">
        <div className="site-wrap site-split">
          <div>
            <Eyebrow>What KashNode does</Eyebrow>
            <h2 className="site-h2">Three capabilities, one connected platform.</h2>
            <p className="site-body">Verification, payment matching and courier dispatch are not three tools — they are one flow. An order moves through all three without anyone retyping, rechecking or chasing it by hand.</p>
            <Link to="/features" className="site-btn site-btn-outline-dark">Explore all features <ArrowRight size={16} /></Link>
          </div>
          <div className="site-ledger">
            {PILLARS.map((item, index) => {
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
        <div className="site-wrap">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="site-h2">A simple flow from order to delivery.</h2>
          <WorkflowSteps />
        </div>
      </section>

      <section className="site-section site-section-dark">
        <div className="site-wrap site-split">
          <div>
            <Eyebrow>Kash AI</Eyebrow>
            <h2 className="site-h2 light">Meet Kash — the voice of your store.</h2>
            <p className="site-body light">Kash is the AI voice assistant inside KashNode. It calls customers, confirms orders, follows up on payments, and handles routine conversations — in natural Bangla, around the clock, without a human on the line.</p>
            <ul className="site-check-list light">
              <li>Order confirmations, in Bangla</li>
              <li>Payment follow-ups when an order is unpaid</li>
              <li>Delivery updates, without a phone call from your team</li>
            </ul>
            <p><Link to="/kash-ai" className="site-btn site-btn-outline-light">Meet Kash AI <ArrowRight size={16} /></Link></p>
          </div>
          <CallInterface />
        </div>
      </section>

      <section className="site-section site-box-band">
        <div className="site-wrap site-split">
          <div className="site-box-large"><BoxRender /></div>
          <div>
            <Eyebrow>KashNode Box</Eyebrow>
            <h2 className="site-h2">Your business SIM, always on.</h2>
            <p className="site-body">The KashNode Box holds your business SIM and keeps it connected to the platform day and night — stable 4G LTE and instant SMS and voice routing. No phone to keep charged.</p>
            <ul className="site-spec-chips">
              <li>Always on, day and night</li>
              <li>Stable 4G LTE</li>
              <li>Your business SIM</li>
              <li>Instant SMS &amp; voice</li>
            </ul>
            <p style={{ marginTop: 24 }}><Link to="/hardware" className="site-btn site-btn-outline-light">See the Box <ArrowRight size={16} /></Link></p>
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <Eyebrow>Works with your existing tools</Eyebrow>
          <h2 className="site-h2">Connect your store, payments and couriers.</h2>
          <IntegrationStrip />
        </div>
      </section>

      <section className="site-section site-section-light">
        <div className="site-wrap site-split">
          <div>
            <Eyebrow>The business impact</Eyebrow>
            <h2 className="site-h2">Turn daily operations into automated growth.</h2>
            <p className="site-body">Spend less time on manual calls, SMS checks and order follow-ups — and more time growing your business.</p>
          </div>
          <div className="site-ledger">
            {OUTCOMES.map((item, index) => (
              <div key={item.title} className="site-ledger-row">
                <span className="site-ledger-num">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <Eyebrow>Trust &amp; security</Eyebrow>
          <h2 className="site-h2">Built to protect your store and your customers.</h2>
          <div className="site-trust-row">
            <div><span className="site-card-icon"><ShieldCheck size={20} /></span><h3>Verified customers only</h3><p>Orders are confirmed against a real phone number before dispatch, reducing fake and fraud orders.</p></div>
            <div><span className="site-card-icon"><Check size={20} /></span><h3>Your SIM, your number</h3><p>Verification messages come from your own business SIM, so customers always hear from your store.</p></div>
            <div><span className="site-card-icon"><Box size={20} /></span><h3>Secure by design</h3><p>Sign-in is protected by email and password with OTP verification, and admin actions are role-checked server-side.</p></div>
          </div>
          <p className="site-note">KashNode is a young product. We publish what the platform actually does today and mark everything else as planned — no inflated claims.</p>
        </div>
      </section>

      <section className="site-section site-section-tint">
        <div className="site-wrap">
          <Eyebrow>Simple &amp; predictable pricing</Eyebrow>
          <h2 className="site-h2">Packages for every stage of your business.</h2>
          <p className="site-body">Choose a plan based on your monthly order volume and voice usage.</p>
          <PricingTiers compact />
          <OverageNote />
          <p className="site-center"><Link to="/pricing" className="site-btn site-btn-outline-dark">Compare all plans <ArrowRight size={16} /></Link></p>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-faq-wrap">
          <Eyebrow>Frequently asked questions</Eyebrow>
          <h2 className="site-h2">Questions, answered.</h2>
          <Faq items={FAQS} />
        </div>
      </section>

      <FinalCta />
    </SiteLayout>
  )
}
