import { Link } from 'react-router-dom'
import { ArrowRight, Globe, PhoneCall, ShieldCheck } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'
import { EcosystemVisual } from '../../components/site/SiteVisuals'

export default function AboutPage() {
  return (
    <SiteLayout title="About KashNode">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Company</Eyebrow>
          <h1>We build automation for <em>online sellers.</em></h1>
          <p className="site-lede">KashNode started in Bangladesh, where online selling runs on COD orders, mobile payments and phone calls — and where a single fake order can cost a seller the delivery charge and a day of work. We build the automation that makes that work disappear.</p>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <Eyebrow>What we believe</Eyebrow>
          <h2 className="site-h2">Small teams should run big operations.</h2>
          <p className="site-body">Most online stores in Bangladesh are run by one person or a small team. They take orders on Facebook and their website, call every customer to confirm, check every payment by hand, and book every parcel themselves. That work does not scale — and it is exactly the work software should do.</p>
          <p className="site-body">KashNode automates the routine parts — verification, payment matching, confirmation calls, courier booking — so sellers can spend their time on products, customers and growth.</p>
          <div className="site-trust-row">
            <div><span className="site-card-icon"><ShieldCheck size={20} /></span><h3>Trust first</h3><p>Every order is verified against a real customer before it ships.</p></div>
            <div><span className="site-card-icon"><PhoneCall size={20} /></span><h3>Human where it matters</h3><p>AI handles routine calls; people step in where judgement is needed.</p></div>
            <div><span className="site-card-icon"><Globe size={20} /></span><h3>Bangladesh-first, global-ready</h3><p>Built for Bangladeshi commerce, designed to travel anywhere.</p></div>
          </div>
        </div>
      </section>

      <section className="site-section site-section-light">
        <div className="site-wrap site-split">
          <div>
            <Eyebrow>The ecosystem</Eyebrow>
            <h2 className="site-h2">Three parts, one company.</h2>
            <p className="site-body">The KashNode Platform is the software. Kash AI is the voice. The KashNode Box is the hardware that keeps your business SIM connected. One team builds all three, so they work as one product — not three vendors.</p>
            <Link to="/product" className="site-btn site-btn-primary">See the platform <ArrowRight size={16} /></Link>
          </div>
          <EcosystemVisual />
        </div>
      </section>

      <FinalCta />
    </SiteLayout>
  )
}
