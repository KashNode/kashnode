import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'

export default function TermsPage() {
  return (
    <SiteLayout title="Terms of Service">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Legal</Eyebrow>
          <h1>Terms of Service</h1>
          <p className="site-lede">Last updated: November 2026. By using KashNode, you agree to these terms.</p>
        </div>
      </section>
      <section className="site-section">
        <div className="site-wrap site-legal">
          <h2>The service</h2>
          <p>KashNode provides a merchant platform, an AI voice assistant (Kash AI) and an optional hardware device (KashNode Box) that together automate order verification, payment matching, customer calls and courier booking for online stores.</p>
          <h2>Your account</h2>
          <p>You are responsible for your account, your password, and the business SIM you connect. Keep your sign-in details safe and tell us promptly if you believe your account has been compromised.</p>
          <h2>Plans and minutes</h2>
          <p>Monthly packages are sized by orders and include an AI minute bundle. Extra AI minutes are charged at a flat ৳7 per minute with in-app recharge. Packages renew monthly. The KashNode Box is a one-time hardware purchase, priced on inquiry.</p>
          <h2>Fair use</h2>
          <p>Use KashNode for your own store’s orders and customers. Do not use it to send spam, impersonate another business, or make calls to people who have not ordered from you.</p>
          <h2>Availability</h2>
          <p>KashNode is a young product and we work to keep it reliable, but we do not guarantee uninterrupted service. Verification, calls and courier booking depend on your SIM, your network and third-party services (payment providers and couriers), which are outside our control.</p>
          <h2>Changes</h2>
          <p>We may update these terms as the product grows. The date above will change when we do, and material changes will be communicated to merchants.</p>
        </div>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}
