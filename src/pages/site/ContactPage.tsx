import { useState, type FormEvent } from 'react'
import { ArrowRight, Check, Mail, MessageCircle } from 'lucide-react'
import { Eyebrow, SiteLayout } from '../../components/site/SiteChrome'
import { FinalCta } from '../../components/site/SiteSections'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('General question')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
  }

  const mailto = `mailto:hello@kashnode.com?subject=${encodeURIComponent(`KashNode contact — ${topic}`)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`)}`

  return (
    <SiteLayout title="Contact Us">
      <section className="site-page-hero">
        <div className="site-wrap">
          <Eyebrow>Contact</Eyebrow>
          <h1>Talk to <em>a human.</em></h1>
          <p className="site-lede">Questions about KashNode, the Box, pricing or your store? Send us a message — a real person replies.</p>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-split">
          <div>
            <h2 className="site-h2">Other ways to reach us.</h2>
            <div className="site-contact-rows">
              <p><Mail size={18} /> <a href="mailto:hello@kashnode.com">hello@kashnode.com</a></p>
              <p><MessageCircle size={18} /> For sales questions, use the form — tell us your store and your monthly order volume.</p>
              <p>For help with your workspace, sign in and check the merchant dashboard first — it shows whether Kash AI, your Box and your store are working.</p>
            </div>
          </div>
          {submitted ? (
            <div className="site-form-success" role="status">
              <Check size={22} />
              <h3>Message ready, {name || 'thank you'}.</h3>
              <p>Your message is prepared below. Send it by email and we will reply.</p>
              <a href={mailto} className="site-btn site-btn-primary">Send message by email <ArrowRight size={16} /></a>
            </div>
          ) : (
            <form className="site-form" onSubmit={handleSubmit}>
              <label>Name<input required value={name} onChange={event => setName(event.target.value)} placeholder="Your name" autoComplete="name" /></label>
              <label>Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@yourstore.com" autoComplete="email" /></label>
              <label>Topic
                <select value={topic} onChange={event => setTopic(event.target.value)}>
                  <option>General question</option>
                  <option>Sales &amp; pricing</option>
                  <option>KashNode Box</option>
                  <option>Support</option>
                  <option>Integration request</option>
                </select>
              </label>
              <label>Message<textarea required rows={5} value={message} onChange={event => setMessage(event.target.value)} placeholder="How can we help?" /></label>
              <button type="submit" className="site-btn site-btn-primary site-btn-block">Send Message <ArrowRight size={16} /></button>
            </form>
          )}
        </div>
      </section>

      <FinalCta />
    </SiteLayout>
  )
}
