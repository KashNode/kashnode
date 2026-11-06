import { KeyRound, Lock, Server, ShieldCheck } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'

const ITEMS = [
  { icon: Lock, title: 'Sign-in protection', text: 'Accounts are protected by email and password with OTP verification on sign-up. Sessions are cookie-based and HttpOnly — the browser never stores a bearer token.' },
  { icon: KeyRound, title: 'Role-checked access', text: 'Merchant and super-admin access are separated by role, and admin actions are enforced server-side — not only in the interface.' },
  { icon: Server, title: 'Your SIM, your number', text: 'Verification messages are sent from your own business SIM in your KashNode Box, so customers always hear from your store.' },
  { icon: ShieldCheck, title: 'Masked by default', text: 'Phone numbers, TrxIDs and device identifiers are masked in the dashboard. Full values are never shown openly.' },
]

export default function SecurityPage() {
  return (
    <SiteLayout title="Security">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Security</Eyebrow>
          <h1>How KashNode <em>protects your store.</em></h1>
          <p className="site-lede">Your customers trust you with their phone numbers and their payments. KashNode is built to earn that trust — and to say plainly what it does and does not do yet.</p>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <div className="site-grid-2">
            {ITEMS.map(item => {
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
          <p className="site-note">KashNode is a young product. We do not claim security certifications we have not earned. If you find a security issue, contact us at hello@kashnode.com and we will take it seriously.</p>
        </div>
      </section>

      <FinalCta />
    </SiteLayout>
  )
}
