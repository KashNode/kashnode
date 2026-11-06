import { Link } from 'react-router-dom'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { Faq, FinalCta, OverageNote, PricingTiers } from '../../components/site/SiteSections'

const FAQS = [
  { q: 'What is included in each plan?', a: 'Paid packages are billed by actual AI voice-call duration: Basic ৳7.00/minute, Standard ৳6.50/minute, and Premium ৳6.00/minute. There are no monthly fees or per-order charges. Free Trial includes 10 complimentary AI minutes.' },
  { q: 'Do I need the KashNode Box?', a: 'You can explore the merchant platform without hardware. Device-connected SIM workflows require a supported and configured device.' },
  { q: 'Is live courier booking available?', a: 'Not generally yet. Courier booking and tracking require provider credentials and a production API adapter. Until that work is complete, tracking responses are marked as demo.' },
  { q: 'How is AI voice usage charged?', a: 'Each call is billed according to its actual duration and your package rate: Basic ৳7.00/minute, Standard ৳6.50/minute, or Premium ৳6.00/minute. Add funds to your wallet to cover usage.' },
]

export default function PricingPage() {
  return (
    <SiteLayout title="E-commerce Automation Plans">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Plans & pricing</Eyebrow>
          <h1>Choose a plan for <em>your store operations.</em></h1>
          <p className="site-lede">Choose the feature package that fits your business. AI voice usage is billed per minute at a transparent package rate — with no monthly subscription or per-order fee. Provider-dependent features are clearly identified before onboarding.</p>
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
