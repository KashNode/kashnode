import { Link } from 'react-router-dom'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { Faq, FinalCta, OverageNote, PricingTiers } from '../../components/site/SiteSections'

const FAQS = [
  { q: 'What is included in each plan?', a: 'Each plan defines a monthly order allowance and an AI-minute bundle. The plan cards above show the current allowances and listed capabilities.' },
  { q: 'Do I need the KashNode Box?', a: 'You can explore the merchant platform without hardware. Device-connected SIM workflows require a supported and configured device.' },
  { q: 'Is live courier booking available?', a: 'Not generally yet. Courier booking and tracking require provider credentials and a production API adapter. Until that work is complete, tracking responses are marked as demo.' },
  { q: 'What happens when AI minutes run out?', a: 'Additional AI minutes are charged at the stated overage rate. Check the current package details before upgrading or recharging.' },
]

export default function PricingPage() {
  return (
    <SiteLayout title="E-commerce Automation Plans">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Plans & pricing</Eyebrow>
          <h1>Choose a plan for <em>your store operations.</em></h1>
          <p className="site-lede">Start with a free trial, then choose the order volume and AI-minute allowance that fits your business. Provider-dependent features are clearly identified before onboarding.</p>
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
