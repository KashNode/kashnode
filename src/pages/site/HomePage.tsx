import { Link } from 'react-router-dom'
import { ArrowRight, Box, Check, PhoneCall, ShieldCheck, Smartphone, Truck, Wallet } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { Faq, FinalCta, IntegrationStrip, OverageNote, PricingTiers } from '../../components/site/SiteSections'
import { BoxRender, CallInterface, DashboardMock, WorkflowSteps } from '../../components/site/SiteVisuals'

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
  { q: 'Do I need the KashNode Box to start?', a: 'No. You can start with the Kash AI App on an Android phone and explore the platform first. The Box is a dedicated device for merchants who want 24/7 reliability with their business SIM always connected.' },
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
            <h1>Run your store operations without the daily <em>manual work.</em></h1>
            <p className="site-lede">Verify customer orders via AI voice calls, match payment confirmations automatically, and move verified orders straight to fulfilment.</p>
            <ul className="site-hero-checks">
              <li><Check size={16} /> Fewer fake orders</li>
              <li><Check size={16} /> Faster confirmation</li>
              <li><Check size={16} /> 24/7 automation</li>
            </ul>
            <div className="site-path-cards">
              <article>
                <span className="site-path-icon"><Smartphone size={20} /></span>
                <h2>Start with the KashNode App</h2>
                <p>Turn any Android phone into your automation gateway instantly.</p>
                <Link to="/login" className="site-btn site-btn-primary">Create Free Workspace <ArrowRight size={16} /></Link>
                <small>Get started in minutes. No hardware needed.</small>
              </article>
              <article className="box">
                <span className="site-path-icon"><Box size={20} /></span>
                <h2>Get the KashNode Box</h2>
                <p>Dedicated plug-and-play business SIM hardware built for 24/7 reliability.</p>
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

      <section className="site-section site-section-light">
        <div className="site-wrap">
          <Eyebrow>What KashNode does</Eyebrow>
          <h2 className="site-h2">Three capabilities, one connected platform.</h2>
          <div className="site-grid-3">
            {PILLARS.map(item => {
              const Icon = item.icon
              return (
                <article key={item.title} className="site-card">
                  <span className="site-card-icon"><Icon size={20} /></span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
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
            <Link to="/kash-ai" className="site-btn site-btn-outline-light">Meet Kash AI <ArrowRight size={16} /></Link>
          </div>
          <CallInterface />
        </div>
      </section>

      <section className="site-section site-section-light">
        <div className="site-wrap site-split">
          <BoxRender />
          <div>
            <Eyebrow>KashNode Box</Eyebrow>
            <h2 className="site-h2">Your business SIM, always on.</h2>
            <p className="site-body">The KashNode Box holds your business SIM and keeps it connected to the platform day and night — continuous power, stable 4G/LTE, and instant SMS and voice routing. No battery to swell, no phone to keep charged.</p>
            <Link to="/hardware" className="site-btn site-btn-dark">See the Box <ArrowRight size={16} /></Link>
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
        <div className="site-wrap">
          <Eyebrow>The business impact</Eyebrow>
          <h2 className="site-h2">Turn daily operations into automated growth.</h2>
          <p className="site-body">Spend less time on manual calls, SMS checks and order follow-ups — and more time growing your business.</p>
          <div className="site-grid-2">
            {OUTCOMES.map(item => (
              <article key={item.title} className="site-card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <Eyebrow>Trust &amp; security</Eyebrow>
          <h2 className="site-h2">Built to protect your store and your customers.</h2>
          <div className="site-grid-3">
            <article className="site-card"><ShieldCheck size={20} /><h3>Verified customers only</h3><p>Orders are confirmed against a real phone number before dispatch, reducing fake and fraud orders.</p></article>
            <article className="site-card"><Check size={20} /><h3>Your SIM, your number</h3><p>Verification messages come from your own business SIM, so customers always hear from your store.</p></article>
            <article className="site-card"><Box size={20} /><h3>Secure by design</h3><p>Sign-in is protected by email and password with OTP verification, and admin actions are role-checked server-side.</p></article>
          </div>
          <p className="site-note">KashNode is a young product. We publish what the platform actually does today and mark everything else as planned — no inflated claims.</p>
        </div>
      </section>

      <section className="site-section site-section-light">
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
