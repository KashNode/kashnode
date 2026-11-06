import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ArrowRight, Globe, Menu, X } from 'lucide-react'
import KashNodeLogo from '../KashNodeLogo'

const NAV_LINKS = [
  { to: '/product', label: 'Product' },
  { to: '/features', label: 'Solutions' },
  { to: '/integrations', label: 'Integrations' },
  { to: '/hardware', label: 'KashNode Box' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/resources', label: 'Resources' },
  { to: '/about', label: 'Company' },
]

function LanguageSelector() {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<'en' | 'bn'>('en')
  return (
    <div className="site-lang">
      <button type="button" className="site-lang-btn" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <Globe size={15} /> {lang === 'en' ? 'EN' : 'বাংলা'}
      </button>
      {open && (
        <div className="site-lang-menu" role="menu">
          <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => { setLang('en'); setOpen(false) }}>English</button>
          <button type="button" className={lang === 'bn' ? 'active' : ''} onClick={() => { setLang('bn'); setOpen(false) }}>বাংলা</button>
          {lang === 'bn' && <p className="site-lang-note">Bengali pages are coming soon — this site is in English for now. Kash speaks Bangla on customer calls.</p>}
        </div>
      )}
    </div>
  )
}

export function SiteNav() {
  const [open, setOpen] = useState(false)
  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Link to="/" className="site-nav-brand" aria-label="KashNode home" onClick={() => setOpen(false)}>
          <KashNodeLogo />
        </Link>
        <nav className="site-nav-links" aria-label="Main navigation">
          {NAV_LINKS.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>{item.label}</NavLink>
          ))}
        </nav>
        <div className="site-nav-actions">
          <LanguageSelector />
          <Link to="/login" className="site-btn site-btn-ghost">Sign In</Link>
          <Link to="/login" className="site-btn site-btn-primary">Start Free</Link>
          <button type="button" className="site-nav-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(value => !value)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="site-nav-mobile" aria-label="Mobile navigation">
          {NAV_LINKS.map(item => (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}>{item.label}</NavLink>
          ))}
          <div className="site-nav-mobile-actions">
            <Link to="/login" className="site-btn site-btn-ghost" onClick={() => setOpen(false)}>Sign In</Link>
            <Link to="/login" className="site-btn site-btn-primary" onClick={() => setOpen(false)}>Start Free</Link>
          </div>
        </nav>
      )}
    </header>
  )
}

const FOOTER_COLS: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { to: '/product', label: 'Platform' },
      { to: '/kash-ai', label: 'Kash AI' },
      { to: '/hardware', label: 'KashNode Box' },
      { to: '/features', label: 'Features' },
      { to: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { to: '/resources', label: 'Guides' },
      { to: '/resources', label: 'Help Center' },
      { to: '/resources', label: 'Documentation' },
      { to: '/resources', label: 'FAQs' },
      { to: '/resources', label: 'Product Updates' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/contact', label: 'Contact' },
      { to: '/security', label: 'Security' },
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/terms', label: 'Terms of Service' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <KashNodeLogo showTagline />
          <p>AI verification and automation for online stores. Verify customers, match payments, and move confirmed orders to fulfilment — without the daily manual work.</p>
        </div>
        {FOOTER_COLS.map(col => (
          <nav key={col.title} aria-label={col.title}>
            <h3>{col.title}</h3>
            <ul>
              {col.links.map(link => (
                <li key={link.label}><Link to={link.to}>{link.label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} KashNode. All rights reserved.</span>
        <span className="site-footer-legal">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/security">Security</Link>
        </span>
      </div>
    </footer>
  )
}

export function SiteLayout({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — KashNode`
    window.scrollTo(0, 0)
  }, [title])
  return (
    <div className="site-page">
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="site-eyebrow">{children}</p>
}

export function DualCta() {
  return (
    <div className="site-dual-cta">
      <Link to="/login" className="site-btn site-btn-primary site-btn-lg">Create Your Workspace <ArrowRight size={17} /></Link>
      <Link to="/hardware" className="site-btn site-btn-outline-light site-btn-lg">Explore KashNode Box <ArrowRight size={17} /></Link>
    </div>
  )
}
