import { Link } from 'react-router-dom'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { Faq, FinalCta, OverageNote, PricingTiers } from '../../components/site/SiteSections'

const FAQS = [
  { q: 'What is included in each plan?', a: 'Paid packages are billed by actual AI voice-call duration at the current rate shown on each package card. Rates and included features are loaded from our live package catalog. There are no monthly fees or per-order charges. Free Trial includes 10 complimentary AI minutes.' },
  { q: 'Do I need the KashNode Box?', a: 'Start with the free Kash AI Android gateway and add a KashNode Box later. The Box is dedicated hardware with a one-time fee and pre-order inquiry.' },
  { q: 'Is live courier booking available?', a: 'Not generally yet. Courier booking and tracking require provider credentials and a production API adapter. Until that work is complete, tracking responses are marked as demo.' },
  { q: 'How is AI voice usage charged?', a: 'Each call is billed according to its actual duration and your package rate: Basic ৳6.50/minute, Standard ৳6.00/minute, or Premium ৳5.50/minute. Add funds to your wallet to cover usage.' },
]

export default function PricingPage() {
  return (
    <SiteLayout title="E-commerce Automation Plans">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Plans & pricing</Eyebrow>
          <h1>Choose a plan for <em>your store operations.</em></h1>
          <p className="site-lede">Choose your feature package and gateway. Start with the free Kash AI Android app, or add the dedicated KashNode Box for ৳8,000 (one-time hardware purchase). AI voice usage is billed per minute, with no monthly subscription or per-order fee.</p>
        </div>
      </section>
      <section className="site-section">
        <div className="site-wrap">
          <PricingTiers />
          <OverageNote />
          <p className="site-note">Live courier booking and tracking are not generally available until provider adapters and credentials are configured. Confirm current feature availability with the team before purchasing.</p>
        </div>
      </section>
      <section className="site-section site-section-light">
        <div className="site-wrap site-faq-wrap">
          <Eyebrow>Pricing questions</Eyebrow>
          <h2 className="site-h2">Know what your plan includes.</h2>
          <Faq items={FAQS} />
          <p className="site-note">For a quote or help choosing a plan, <Link to="/contact">contact the team</Link>.</p>
        </div>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}
