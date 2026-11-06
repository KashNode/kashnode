import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'

export default function PrivacyPage() {
  return (
    <SiteLayout title="Privacy Policy">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Legal</Eyebrow>
          <h1>Privacy Policy</h1>
          <p className="site-lede">Last updated: November 2026. This page explains what KashNode collects, why, and what you can ask us to do about it.</p>
        </div>
      </section>
      <section className="site-section">
        <div className="site-wrap site-legal">
          <h2>What we collect</h2>
          <p>When you create a workspace, we collect your name, email address and store details so we can run your account. When your store uses KashNode, we process order details, customer phone numbers, payment verification codes and call records — only as needed to verify orders, match payments, make confirmation calls and book couriers.</p>
          <h2>How we use it</h2>
          <p>Your data is used to operate the KashNode Platform, Kash AI and your KashNode Box for your store. We do not sell your data or your customers’ data. Verification messages are sent from your own business SIM, and call recordings and summaries exist so you can review what Kash said on your behalf.</p>
          <h2>What we share</h2>
          <p>We share order and delivery details with the courier you choose (Steadfast or Pathao) so parcels can be booked and delivered. We do not share your data with advertisers or data brokers.</p>
          <h2>Your choices</h2>
          <p>You can ask us for a copy of the data we hold about your workspace, ask us to correct it, or ask us to delete your account and its data. Contact us at hello@kashnode.com and we will help.</p>
          <h2>Changes</h2>
          <p>If this policy changes in a way that affects you, we will update this page and the date above.</p>
        </div>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}
