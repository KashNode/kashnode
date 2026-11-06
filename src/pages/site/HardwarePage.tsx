import { useState, type FormEvent } from 'react'
import { Activity, ArrowRight, Check, Plug, Radio, Signal, Zap } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'
import { BoxRender } from '../../components/site/SiteVisuals'

const BENEFITS = [
  { icon: Zap, title: 'Always on, day and night', text: 'The Box stays connected to the platform around the clock, so verification and calls keep running — no phone to keep charged, nothing to switch off overnight.' },
  { icon: Signal, title: 'Stable 4G LTE connection', text: 'A dedicated cellular connection with strong, stable signal — built to stay online where a phone in a drawer drops out.' },
  { icon: Radio, title: 'Instant SMS & voice routing', text: 'Verification SMS and Kash’s calls go through your business SIM in the Box, straight to the platform, with no human touch.' },
  { icon: Activity, title: 'Always connected', text: 'Signal, balance and sync status are visible in your dashboard, with an alert the moment the Box goes offline.' },
]

const SETUP = [
  { title: 'Plug it in', text: 'Connect the Box to power and place it where signal is strongest.' },
  { title: 'Insert your business SIM', text: 'Your own SIM goes into the Box — customers always hear from your store’s number.' },
  { title: 'Connect to KashNode', text: 'The Box links to your workspace and appears in your dashboard, online and ready.' },
  { title: 'Automation starts', text: 'Verification SMS and Kash’s calls run through the Box from the first order.' },
]

export default function HardwarePage() {
  const [name, setName] = useState('')
  const [businessUrl, setBusinessUrl] = useState('')
  const [volume, setVolume] = useState('100–500 orders / month')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
  }

  const mailto = `mailto:hello@kashnode.com?subject=${encodeURIComponent('KashNode Box availability inquiry')}&body=${encodeURIComponent(
    `Name: ${name}\nBusiness URL: ${businessUrl}\nMonthly order volume: ${volume}\nEmail: ${email}\nPhone: ${phone}\n\nI would like to know about KashNode Box availability.`,
  )}`

  return (
    <SiteLayout title="KashNode Box — Dedicated Business SIM Hardware">
      <section className="site-page-hero site-hero-dark">
        <div className="site-wrap site-split">
          <div>
            <Eyebrow>KashNode Box</Eyebrow>
            <h1>Your business SIM, <em>always on.</em></h1>
            <p className="site-lede">A sleek, plug-and-play Kash Node device. The Box connects your business SIM to KashNode and keeps your verification and calls running — day and night.</p>
            <div className="site-dual-cta">
              <a href="#inquiry" className="site-btn site-btn-primary site-btn-lg">Request Availability <ArrowRight size={17} /></a>
              <a href="#setup" className="site-btn site-btn-outline-light site-btn-lg">How setup works</a>
            </div>
          </div>
          <div className="site-box-large"><BoxRender /></div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <Eyebrow>Why a dedicated device</Eyebrow>
          <h2 className="site-h2">A phone can do the job. The Box does it better.</h2>
          <div className="site-compare">
            <table>
              <thead><tr><th></th><th>A regular smartphone</th><th>KashNode Box</th></tr></thead>
              <tbody>
                <tr><td>Power</td><td>Runs on battery — needs charging, swells over time</td><td><strong>Always on, day and night</strong></td></tr>
                <tr><td>Connectivity</td><td>Signal drops, calls interrupt, apps get killed</td><td><strong>4G LTE, built to stay online</strong></td></tr>
                <tr><td>Reliability</td><td>Shared with personal use, notifications, updates</td><td><strong>Dedicated to your business SIM only</strong></td></tr>
                <tr><td>Visibility</td><td>No easy way to see if it is working</td><td><strong>Signal, balance and sync in your dashboard</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="site-section site-section-light">
        <div className="site-wrap">
          <Eyebrow>Built for 24/7</Eyebrow>
          <h2 className="site-h2">Made to run your store’s communications.</h2>
          <div className="site-ledger">
            {BENEFITS.map((item, index) => {
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

      <section className="site-section" id="setup">
        <div className="site-wrap">
          <Eyebrow>Setup journey</Eyebrow>
          <h2 className="site-h2">From box to automation in four steps.</h2>
          <ol className="site-flow">
            {SETUP.map((step, index) => (
              <li key={step.title}>
                <span className="site-flow-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="site-flow-icon"><Plug size={20} /></span>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="site-body">The Box works with the KashNode Platform — it is hardware for the software you already use. You can start with the Platform first and add the Box later; your workspace, orders and settings carry over.</p>
        </div>
      </section>

      <section className="site-section site-section-light" id="inquiry">
        <div className="site-wrap site-split">
          <div>
            <Eyebrow>Pre-order inquiry</Eyebrow>
            <h2 className="site-h2">Request Box availability.</h2>
            <p className="site-body">The KashNode Box is a one-time hardware purchase. Tell us about your store and we will confirm availability and pricing for you — no payment is taken here.</p>
            <ul className="site-check-list">
              <li>One-time hardware fee — priced on inquiry</li>
              <li>Works with your existing KashNode workspace</li>
              <li>Your business SIM, your number</li>
            </ul>
          </div>
          {submitted ? (
            <div className="site-form-success" role="status">
              <Check size={22} />
              <h3>Inquiry ready, {name || 'thank you'}.</h3>
              <p>Your details are prepared below. Send them by email and we will confirm Box availability.</p>
              <a href={mailto} className="site-btn site-btn-primary">Send inquiry by email <ArrowRight size={16} /></a>
            </div>
          ) : (
            <form className="site-form" onSubmit={handleSubmit}>
              <label>Name<input required value={name} onChange={event => setName(event.target.value)} placeholder="Your name" autoComplete="name" /></label>
              <label>Business URL<input value={businessUrl} onChange={event => setBusinessUrl(event.target.value)} placeholder="https://yourstore.com" autoComplete="url" /></label>
              <label>Monthly order volume
                <select value={volume} onChange={event => setVolume(event.target.value)}>
                  <option>Under 100 orders / month</option>
                  <option>100–500 orders / month</option>
                  <option>500–1,000 orders / month</option>
                  <option>1,000–3,000 orders / month</option>
                  <option>Over 3,000 orders / month</option>
                </select>
              </label>
              <label>Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@yourstore.com" autoComplete="email" /></label>
              <label>Phone<input required type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+880 1XXX-XXXXXX" autoComplete="tel" /></label>
              <button type="submit" className="site-btn site-btn-primary site-btn-block">Request Box Availability <ArrowRight size={16} /></button>
            </form>
          )}
        </div>
      </section>

      <FinalCta />
    </SiteLayout>
  )
}
