import { Link } from 'react-router-dom'
import {
  Box, Clock, CreditCard, FileText, HelpCircle, Layers,
  Lock, MessageSquare, PhoneCall, RefreshCw, ShieldAlert, ShieldCheck,
  Smartphone, Truck,
} from 'lucide-react'
import { SiteLayout } from '../../components/site/SiteChrome'
import { BoxRender, WorkspaceDiagram } from '../../components/site/SiteVisuals'

const BRANDS = ['WooCommerce', 'Shopify', 'bKash', 'Nagad', 'Rocket', 'Upay', 'Steadfast', 'Pathao']

const FEATURES = [
  { icon: ShieldCheck, title: 'Order verification', text: 'Confirm real customers with an SMS from your own business SIM — before anything ships.' },
  { icon: CreditCard, title: 'Payment matching', text: 'Configured payment messages checked against order references, with TrxID matching.' },
  { icon: PhoneCall, title: 'Kash AI voice', text: 'Natural Bangla calls for confirmations, follow-ups and delivery updates — male or female voice.' },
  { icon: Box, title: 'KashNode Box', text: 'Your business SIM, always on. ৳8,000 one-time hardware purchase.' },
  { icon: Clock, title: 'Call history', text: 'Every call logged with status and duration — 7 days on Basic, 30 days on Standard.' },
  { icon: Layers, title: 'Multi-device failover', text: 'Up to 2 devices and SIMs on Standard, unlimited on Premium — if one drops, the other takes over.' },
  { icon: ShieldAlert, title: 'Fraud detection', text: 'Advanced fake-order detection and an automatic blocklist on Premium.' },
  { icon: Truck, title: 'Courier booking', text: 'Verified orders ready for Steadfast or Pathao — booked from the same workspace.' },
]

const SECURITY = [
  { icon: Smartphone, title: 'Your business SIM', text: 'Messages and calls go out from your own number — customers always know it is you.' },
  { icon: MessageSquare, title: 'SMS code verification', text: 'A code proves the customer is real — before an order is ever packed.' },
  { icon: FileText, title: 'TrxID matching', text: 'Every payment message matched to its order by transaction ID.' },
  { icon: RefreshCw, title: 'Failover, built in', text: 'Two SIMs on Standard, unlimited devices on Premium — a dropped connection never stops verification.' },
  { icon: Lock, title: 'Your data stays yours', text: 'Orders, customers and call history live in your workspace — nothing shared, nothing sold.' },
  { icon: HelpCircle, title: 'Human support', text: 'Email and ticket support on Basic, priority chat on Standard, VIP phone support on Premium.' },
]

export default function HomePage() {
  return (
    <SiteLayout
      title="AI Verification & Automation for Online Stores"
      variant="light"
      announcement={(
        <div className="r2-announce">
          Free Trial — 10 complimentary AI minutes, no card required.
          <Link to="/pricing">Learn more →</Link>
        </div>
      )}
    >
      <section className="r2-hero">
        <div className="r2-wrap">
          <h1 className="r2-h1">Your fastest path to verified orders.</h1>
          <div className="r2-hero-row">
            <p className="r2-sub r2-hero-sub">Intuitive automation to verify every order, match every payment, and call every customer — from your first order to your millionth.</p>
            <div className="r2-hero-actions">
              <Link to="/login" className="r2-btn r2-btn-black">Start for free →</Link>
              <Link to="/contact" className="r2-btn r2-btn-outline">Talk to sales</Link>
            </div>
          </div>
          <WorkspaceDiagram />
        </div>
      </section>

      <section className="r2-trusted">
        <div className="r2-wrap">
          <div className="r2-trusted-top">
            <span className="r2-eyebrow">Works with your existing tools</span>
            <Link to="/integrations" className="r2-vlink">See integrations →</Link>
          </div>
          <div className="r2-brands">
            {BRANDS.map(brand => <span key={brand}>{brand}</span>)}
          </div>
          <div className="r2-divider" />
        </div>
      </section>

      <section className="r2-section">
        <div className="r2-wrap">
          <h2 className="r2-h2">Three steps. Zero manual work.</h2>
          <p className="r2-sub">From a new order to a verified, ready-to-ship parcel — without a single phone call from your team.</p>
          <div className="r2-steps">
            <div className="r2-step">
              <span className="r2-badge">1</span>
              <h3>Connect your store</h3>
              <p>Plug in WooCommerce, Shopify or a custom store. Your orders flow into one workspace — no retyping, no spreadsheets.</p>
              <div className="r2-mock">
                <div className="r2-mock-row"><span className="r2-dot" /><div>WooCommerce<div><small>Connected · 128 orders synced</small></div></div><span className="r2-ok">✓ Live</span></div>
                <div className="r2-mock-row"><span className="r2-dot" /><div>Shopify<div><small>Connected · 46 orders synced</small></div></div><span className="r2-ok">✓ Live</span></div>
                <div className="r2-mock-row"><span className="r2-dot" /><div>Custom store · API<div><small>Webhook active</small></div></div><span className="r2-ok">✓ Live</span></div>
              </div>
            </div>
            <div className="r2-step">
              <span className="r2-badge">2</span>
              <h3>Kash verifies every order</h3>
              <p>COD orders get an SMS from your business SIM. Payments are checked by code and TrxID. Fake orders stop at the door.</p>
              <div className="r2-mock">
                <div className="r2-mono"><span className="r2-g">✓</span> Order #2481 · SMS code verified<br /><span className="r2-g">✓</span> Order #2480 · bKash TrxID matched<br /><span className="r2-g">✓</span> Order #2479 · Kash AI confirmed<br /><span className="r2-wait-text">…</span> Order #2478 · waiting for code</div>
              </div>
            </div>
            <div className="r2-step">
              <span className="r2-badge">3</span>
              <h3>Fulfil with confidence</h3>
              <p>Only verified orders move to dispatch — booked with Steadfast or Pathao, with the customer already informed.</p>
              <div className="r2-mock">
                <div className="r2-mock-row"><span className="r2-dot" /><div>Order #2481 · Steadfast<div><small>Booked · On the way</small></div></div><span className="r2-ok">Shipped</span></div>
                <div className="r2-mock-row"><span className="r2-dot" /><div>Order #2480 · Pathao<div><small>Booked · On the way</small></div></div><span className="r2-ok">Shipped</span></div>
                <div className="r2-mock-row"><span className="r2-dot" /><div>Order #2479 · Steadfast<div><small>Ready to book</small></div></div><span className="r2-ok">Verified</span></div>
              </div>
            </div>
          </div>
          <p className="r2-note">Order numbers and figures in the previews on this page are sample data.</p>
        </div>
      </section>

      <section className="r2-band">
        <div className="r2-wrap r2-band-grid">
          <div>
            <h2 className="r2-h2">Whatever you sell,<br />KashNode handles it.</h2>
            <Link to="/features" className="r2-btn r2-btn-black">View features →</Link>
          </div>
          <div className="r2-tiles">
            {BRANDS.map(brand => <div key={brand} className="r2-tile">{brand}</div>)}
          </div>
        </div>
      </section>

      <section className="r2-section r2-alt-section">
        <div className="r2-wrap">
          <h2 className="r2-h2">Automate orders with zero manual work.</h2>
          <p className="r2-sub">Verification, payments, calls and fulfilment — connected in one workspace.</p>
          <div className="r2-alt-row">
            <div className="r2-alt-text">
              <h3>COD verification that stops fake orders</h3>
              <p>Every cash-on-delivery order gets an SMS from your own business SIM. Only real customers confirm — fake and fraud orders never reach dispatch.</p>
              <Link to="/features" className="r2-vlink">Learn more →</Link>
            </div>
            <div className="r2-visual">
              <div className="r2-sms"><span className="r2-sms-from">KashNode SMS <span>· now</span></span><p>Your verification code is <b>482913</b>. Share it only to confirm your order #2481.</p></div>
              <div style={{ height: 12 }} />
              <div className="r2-mock-row"><span className="r2-dot" /><div>Order #2481 · Code verified<div><small>Real customer confirmed</small></div></div><span className="r2-ok">✓ Verified</span></div>
            </div>
          </div>
          <div className="r2-alt-row">
            <div className="r2-alt-text">
              <h3>Payment matching, automatic</h3>
              <p>bKash, Nagad, Rocket and Upay messages are checked against order references, with TrxID matching — no more manual checking in your inbox.</p>
              <Link to="/features" className="r2-vlink">Learn more →</Link>
            </div>
            <div className="r2-visual">
              <div className="r2-mock-row"><span className="r2-dot" /><div>Order #2480 · bKash<div><small>TrxID 9KX4M2P7 · ৳1,450</small></div></div><span className="r2-ok">✓ Matched</span></div>
              <div className="r2-mock-row"><span className="r2-dot" /><div>Order #2479 · Nagad<div><small>TrxID 7QW8N1R3 · ৳890</small></div></div><span className="r2-ok">✓ Matched</span></div>
              <div className="r2-mock-row"><span className="r2-dot" /><div>Order #2478 · Rocket<div><small>TrxID pending · ৳2,100</small></div></div><span className="r2-wait">Waiting</span></div>
            </div>
          </div>
          <div className="r2-alt-row">
            <div className="r2-alt-text">
              <h3>Kash AI calls your customers</h3>
              <p>Kash confirms orders, follows up on payments and shares delivery updates in natural Bangla — around the clock, without a human on the line.</p>
              <Link to="/kash-ai" className="r2-vlink">Meet Kash AI →</Link>
            </div>
            <div className="r2-term">
              <div className="r2-term-head"><span>Kash AI · Order #2481</span><span><span className="r2-sample">Sample call</span> <span className="r2-g">✓ Live</span></span></div>
              <div><span className="r2-g">Kash:</span> আসসালামু আলাইকুম, আমি Kash — অর্ডার #2481 কনফার্ম করতে কল করেছি।</div>
              <div><span className="r2-g">Customer:</span> জি, কনফার্ম করেন।</div>
              <div><span className="r2-g">Kash:</span> ধন্যবাদ। আপনার অর্ডারটি কনফার্ম হয়েছে।</div>
              <div className="r2-w">Call logged · 1m 12s · Male voice</div>
            </div>
          </div>
          <div className="r2-alt-row">
            <div className="r2-alt-text">
              <h3>Your business SIM, always on</h3>
              <p>The KashNode Box (৳8,000 one-time) holds your business SIM and keeps it connected to the platform day and night — stable connectivity and instant SMS and voice routing. No phone to keep charged.</p>
              <Link to="/hardware" className="r2-vlink">See the Box →</Link>
            </div>
            <div className="r2-visual"><BoxRender /></div>
          </div>
        </div>
      </section>

      <section className="r2-section">
        <div className="r2-wrap">
          <h2 className="r2-h2">Everything you need, built in.</h2>
          <p className="r2-sub">Verification, payments, calls and fulfilment — primitives that just work.</p>
          <div className="r2-feat-grid">
            {FEATURES.map(feature => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="r2-feat">
                  <span className="r2-feat-ic"><Icon size={26} /></span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="r2-section" style={{ paddingTop: 0 }}>
        <div className="r2-wrap">
          <h2 className="r2-h2">Secure and reliable by default.</h2>
          <p className="r2-sub">Built for real stores, not demos.</p>
          <div className="r2-feat-grid r2-feat-three">
            {SECURITY.map(feature => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="r2-feat">
                  <span className="r2-feat-ic"><Icon size={26} /></span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="r2-final">
        <div className="r2-wrap">
          <h2 className="r2-h2">Start automating your store</h2>
          <p className="r2-sub">Zero manual work, zero surprises.</p>
          <Link to="/login" className="r2-btn r2-btn-black">Start for free →</Link>
        </div>
      </section>
    </SiteLayout>
  )
}
