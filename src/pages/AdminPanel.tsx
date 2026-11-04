import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ArrowUpRight,
  Box,
  Check,
  CircleDollarSign,
  Clock3,
  LayoutDashboard,
  LogOut,
  Package,
  Pause,
  Phone,
  Play,
  Search,
  ShieldCheck,
  Signal,
  Store,
  Truck,
  Users,
  Wallet,
  Wifi,
  X,
} from 'lucide-react'
import KashNodeLogo from '../components/KashNodeLogo'
import type { AuthUser } from '../lib/auth'

type Props = { user: AuthUser; onSignOut: () => void }
type Section =
  | 'overview'
  | 'merchants'
  | 'minutes'
  | 'verifications'
  | 'calls'
  | 'courier'
  | 'hardware'
  | 'licensing'
  | 'system'
type PackageId = 'free' | 'basic' | 'standard' | 'premium'
type MerchantStatus = 'active' | 'trial' | 'suspended'
type Voice = 'male' | 'female'

type PackageInfo = { id: PackageId; name: string; price: number; orders: number; minutes: number; note: string }

const PACKAGES: PackageInfo[] = [
  { id: 'free', name: 'Free Trial', price: 0, orders: 10, minutes: 10, note: 'Trial — no card required' },
  { id: 'basic', name: 'Basic', price: 2000, orders: 300, minutes: 300, note: 'For new stores' },
  { id: 'standard', name: 'Standard', price: 5500, orders: 1000, minutes: 1000, note: 'Most popular' },
  { id: 'premium', name: 'Premium', price: 14000, orders: 3000, minutes: 3000, note: 'Priority support' },
]

const packageById = (id: PackageId) => PACKAGES.find((item) => item.id === id) ?? PACKAGES[0]
const formatBdt = (value: number) => `৳${value.toLocaleString('en-US')}`

type Merchant = {
  id: string
  name: string
  email: string
  packageId: PackageId
  status: MerchantStatus
  boxes: number
  minutesLeft: number
}

// Same demo merchants as PR #12, so the numbers on this deck reconcile with the old panel.
const INITIAL_MERCHANTS: Merchant[] = [
  { id: 'M-1001', name: 'Dhaka Fashion Hub', email: 'hello@dhakafashion.example', packageId: 'standard', status: 'active', boxes: 3, minutesLeft: 612 },
  { id: 'M-1002', name: 'Chittagong Electronics', email: 'sales@ctg-electronics.example', packageId: 'premium', status: 'active', boxes: 5, minutesLeft: 1840 },
  { id: 'M-1003', name: 'Sylhet Grocery Mart', email: 'care@sylhetgrocery.example', packageId: 'basic', status: 'active', boxes: 1, minutesLeft: 96 },
  { id: 'M-1004', name: 'Khulna Beauty Store', email: 'shop@khulnabeauty.example', packageId: 'basic', status: 'suspended', boxes: 1, minutesLeft: 0 },
  { id: 'M-1005', name: 'Rajshahi Mobile Zone', email: 'info@rajmobile.example', packageId: 'standard', status: 'active', boxes: 2, minutesLeft: 430 },
  { id: 'M-1006', name: 'Barishal Home Essentials', email: 'hello@barishalhome.example', packageId: 'free', status: 'trial', boxes: 1, minutesLeft: 7 },
  { id: 'M-1007', name: 'Rangpur Fashion Point', email: 'team@rangpurfashion.example', packageId: 'premium', status: 'active', boxes: 4, minutesLeft: 2210 },
  { id: 'M-1008', name: 'Mymensingh Daily Shop', email: 'daily@mymensinghshop.example', packageId: 'basic', status: 'active', boxes: 2, minutesLeft: 148 },
]

type HardwareBox = {
  unit: string
  merchant: string
  online: boolean
  signal: number
  sim: string
  simBalance: number
  dataMb: number
  latencyMs: number
  smsToday: number
  lastSync: string
}

const INITIAL_BOXES: HardwareBox[] = [
  { unit: 'KN-BOX-01', merchant: 'Dhaka Fashion Hub', online: true, signal: 5, sim: 'Business SIM', simBalance: 412, dataMb: 1840, latencyMs: 38, smsToday: 112, lastSync: '2 min ago' },
  { unit: 'KN-BOX-02', merchant: 'Chittagong Electronics', online: true, signal: 4, sim: 'Business SIM', simBalance: 268, dataMb: 940, latencyMs: 52, smsToday: 86, lastSync: '4 min ago' },
  { unit: 'KN-BOX-03', merchant: 'Sylhet Grocery Mart', online: true, signal: 5, sim: 'Business SIM', simBalance: 355, dataMb: 1210, latencyMs: 41, smsToday: 44, lastSync: '1 min ago' },
  { unit: 'KN-BOX-04', merchant: 'Khulna Beauty Store', online: false, signal: 0, sim: 'Business SIM', simBalance: 96, dataMb: 0, latencyMs: 0, smsToday: 0, lastSync: '3 hrs ago' },
  { unit: 'KN-BOX-05', merchant: 'Rajshahi Mobile Zone', online: true, signal: 4, sim: 'Business SIM', simBalance: 189, dataMb: 760, latencyMs: 63, smsToday: 57, lastSync: '6 min ago' },
  { unit: 'KN-BOX-06', merchant: 'Rangpur Fashion Point', online: true, signal: 5, sim: 'Business SIM', simBalance: 521, dataMb: 2100, latencyMs: 35, smsToday: 93, lastSync: '3 min ago' },
]

type ReviewItem = { id: string; merchant: string; channel: string; amount: number; detail: string }
const INITIAL_QUEUE: ReviewItem[] = [
  { id: '#KN-8841', merchant: 'Dhaka Fashion Hub', channel: 'bKash', amount: 1850, detail: 'TrxID partially matched — needs a human check' },
  { id: '#KN-8840', merchant: 'Sylhet Grocery Mart', channel: 'COD SMS', amount: 950, detail: 'SMS delivered, verification code not yet entered' },
  { id: '#KN-8839', merchant: 'Rajshahi Mobile Zone', channel: 'Nagad', amount: 2400, detail: 'Amount matches, sender number differs from order phone' },
]

const CALL_ROWS = [
  { id: 'C-221', merchant: 'Dhaka Fashion Hub', outcome: 'Confirmed', minutes: 3, voice: 'female' as Voice },
  { id: 'C-220', merchant: 'Chittagong Electronics', outcome: 'Confirmed', minutes: 2, voice: 'male' as Voice },
  { id: 'C-219', merchant: 'Sylhet Grocery Mart', outcome: 'Failed — no answer', minutes: 1, voice: 'female' as Voice },
  { id: 'C-218', merchant: 'Rangpur Fashion Point', outcome: 'Confirmed', minutes: 4, voice: 'male' as Voice },
]

const COURIER_ROWS = [
  { id: 'P-501', merchant: 'Dhaka Fashion Hub', courier: 'Steadfast', status: 'Delivered', pin: '4821' },
  { id: 'P-500', merchant: 'Chittagong Electronics', courier: 'Pathao', status: 'In transit', pin: '9174' },
  { id: 'P-499', merchant: 'Sylhet Grocery Mart', courier: 'Steadfast', status: 'Booked', pin: '—' },
  { id: 'P-498', merchant: 'Rajshahi Mobile Zone', courier: 'Pathao', status: 'Delivery failed', pin: '—' },
]

const WALLET_ROWS = [
  { date: 'Nov 4', merchant: 'Dhaka Fashion Hub', detail: '+150 min recharge', amount: '৳1,050' },
  { date: 'Nov 3', merchant: 'Rangpur Fashion Point', detail: '+300 min recharge', amount: '৳2,100' },
  { date: 'Nov 2', merchant: 'Sylhet Grocery Mart', detail: '+60 min recharge', amount: '৳420' },
]

const LIVE_FEED = [
  'Kash just confirmed an order for Dhaka Fashion Hub by phone call.',
  'A bKash TrxID matched for Chittagong Electronics — ৳1,850 verified.',
  'Steadfast parcel P-501 marked delivered, PIN 4821 confirmed.',
  'KN-BOX-04 is still offline — Khulna Beauty Store has no live box.',
  'A COD SMS verification was sent from the Sylhet Grocery Mart box.',
]

const SECTIONS: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'merchants', label: 'Merchants', icon: Store },
  { id: 'minutes', label: 'Minutes & Billing', icon: Wallet },
  { id: 'verifications', label: 'Verifications', icon: ShieldCheck },
  { id: 'calls', label: 'Kash AI Calls', icon: Phone },
  { id: 'courier', label: 'Courier', icon: Truck },
  { id: 'hardware', label: 'Hardware Boxes', icon: Box },
  { id: 'licensing', label: 'Licensing & Packages', icon: Package },
  { id: 'system', label: 'System & Audit', icon: Activity },
]

function TiltCard({ children, ghost, className = '' }: { children: ReactNode; ghost: string; className?: string }) {
  const [transform, setTransform] = useState('perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)')
  return (
    <motion.div
      className={`cd-tilt ${className}`}
      style={{ transform }}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = (event.clientX - rect.left) / rect.width - 0.5
        const y = (event.clientY - rect.top) / rect.height - 0.5
        setTransform(`perspective(900px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(-3px)`)
      }}
      onMouseLeave={() => setTransform('perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)')}
    >
      <span className="cd-ghost" aria-hidden="true">{ghost}</span>
      {children}
    </motion.div>
  )
}

function Gauge({ label, value, display }: { label: string; value: number; display: string }) {
  const r = 34
  const circumference = 2 * Math.PI * r
  return (
    <div className="cd-gauge">
      <svg viewBox="0 0 84 84" role="img" aria-label={`${label} ${display}`}>
        <circle cx="42" cy="42" r={r} className="cd-gauge-track" />
        <circle
          cx="42" cy="42" r={r} className="cd-gauge-value"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <strong>{display}</strong>
      <small>{label}</small>
    </div>
  )
}

function SignalBars({ level }: { level: number }) {
  return (
    <span className="cd-signal" aria-label={`Signal ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <i key={bar} className={bar <= level ? 'on' : ''} style={{ height: `${6 + bar * 3}px` }} />
      ))}
    </span>
  )
}

export default function AdminPanel({ user, onSignOut }: Props) {
  const [section, setSection] = useState<Section>('overview')
  const [merchants, setMerchants] = useState<Merchant[]>(INITIAL_MERCHANTS)
  const [boxes] = useState<HardwareBox[]>(INITIAL_BOXES)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | MerchantStatus>('all')
  const [notice, setNotice] = useState('')
  const [feedIndex, setFeedIndex] = useState(0)
  const [dhakaTime, setDhakaTime] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [voices, setVoices] = useState<Record<string, Voice>>({ 'Dhaka Fashion Hub': 'female', 'Chittagong Electronics': 'male', 'Sylhet Grocery Mart': 'female', 'Rangpur Fashion Point': 'male' })
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>(INITIAL_QUEUE)
  const [auditLog, setAuditLog] = useState<string[]>(['Panel opened in command-deck layout (sample data).'])
  const paletteInputRef = useRef<HTMLInputElement>(null)

  const activeMerchants = merchants.filter((item) => item.status === 'active')
  const totalRevenue = activeMerchants.reduce((sum, item) => sum + packageById(item.packageId).price, 0)
  const connectedBoxes = boxes.filter((item) => item.online).length
  const isAdmin = user.role === 'admin'
  const sectionTitle = SECTIONS.find((item) => item.id === section)?.label ?? 'Overview'

  useEffect(() => {
    const tick = () => setDhakaTime(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Dhaka' }).format(new Date()))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setFeedIndex((value) => (value + 1) % LIVE_FEED.length), 4600)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (paletteOpen) paletteInputRef.current?.focus()
  }, [paletteOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((value) => !value)
        return
      }
      if (event.key === 'Escape') { setPaletteOpen(false); return }
      if (typing || paletteOpen) return
      const index = Number.parseInt(event.key, 10)
      if (index >= 1 && index <= SECTIONS.length) setSection(SECTIONS[index - 1].id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paletteOpen])

  const filteredMerchants = useMemo(() => {
    const query = search.trim().toLowerCase()
    return merchants.filter((item) => {
      const matchesQuery = !query || item.name.toLowerCase().includes(query) || item.email.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [merchants, search, statusFilter])

  const paletteMerchants = useMemo(() => {
    const query = paletteQuery.trim().toLowerCase()
    if (!query) return merchants.slice(0, 4)
    return merchants.filter((item) => item.name.toLowerCase().includes(query))
  }, [merchants, paletteQuery])

  const addAudit = (text: string) => setAuditLog((current) => [text, ...current].slice(0, 12))

  const changePackage = (id: string, packageId: PackageId) => {
    const merchant = merchants.find((item) => item.id === id)
    setMerchants((current) => current.map((item) => (item.id === id ? { ...item, packageId } : item)))
    addAudit(`Package changed (browser only): ${merchant?.name ?? 'Merchant'} → ${packageById(packageId).name}.`)
    setNotice(`Demo only: ${merchant?.name ?? 'Merchant'} moved to ${packageById(packageId).name} in this view. No real merchant was changed — that needs a super-admin API.`)
  }

  const toggleSuspend = (merchant: Merchant) => {
    const nextStatus: MerchantStatus = merchant.status === 'suspended' ? 'active' : 'suspended'
    setMerchants((current) => current.map((item) => (item.id === merchant.id ? { ...item, status: nextStatus } : item)))
    addAudit(`Status changed (browser only): ${merchant.name} → ${nextStatus}.`)
    setNotice(`Demo only: ${merchant.name} is now ${nextStatus} in this view. No real merchant was changed — that needs a super-admin API.`)
  }

  const reviewItem = (item: ReviewItem, decision: 'approved' | 'rejected') => {
    setReviewQueue((current) => current.filter((entry) => entry.id !== item.id))
    addAudit(`Review ${decision} (browser only): ${item.id} — ${item.merchant}.`)
    setNotice(`Demo only: ${item.id} was ${decision} in this view.`)
  }

  const toggleVoice = (merchantName: string) => {
    const next: Voice = (voices[merchantName] ?? 'female') === 'female' ? 'male' : 'female'
    setVoices((current) => ({ ...current, [merchantName]: next }))
    addAudit(`Kash voice changed (browser only): ${merchantName} → ${next}.`)
    setNotice(`Demo only: Kash voice for ${merchantName} is now ${next} in this view.`)
  }

  return (
    <div className="cd-page">
        <div className="cd-ticker" aria-label="KashNode operations preview ticker">
          <div className="cd-ticker-brand"><strong>KashNode</strong><span>Super Admin · visual console</span></div>
          <div className="cd-ticker-marquee" aria-hidden="true"><div className="cd-ticker-track">
            {['KN-BOX-04 offline · sample data','8 merchants in demo workspace','6 KashNode Boxes · 5 online','৳43,000 monthly package value · sample','3 reviews waiting in sample queue','96.4% MFS match rate · sample','KN-BOX-04 offline · sample data','8 merchants in demo workspace','6 KashNode Boxes · 5 online','৳43,000 monthly package value · sample','3 reviews waiting in sample queue','96.4% MFS match rate · sample'].map((item,index)=><span key={index}>{item}</span>)}
          </div></div>
          <span className="cd-preview-tag">Layout preview · sample data</span>
        </div>
        <div className="cd-shell">
          <motion.aside className="cd-rail" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.35 }} aria-label="Command deck navigation">
            <div className="cd-rail-brand"><KashNodeLogo /><span className="cd-admin-badge">SUPER ADMIN</span></div>
            <div className="cd-rail-clock"><strong>{dhakaTime || '--:--:--'}</strong><span>Dhaka · GMT+6</span><div className="cd-wave" aria-hidden="true">{[7,13,9,14,6].map((height,index)=><i key={index} style={{height:`${height}px`,animationDelay:`${index*.12}s`}} />)}</div></div>
            <nav className="cd-nav" aria-label="Admin sections">
              <div className="cd-nav-group"><div className="cd-nav-label">Operations</div>
                {SECTIONS.slice(0,4).map((item,index)=>{const Icon=item.icon;return <button key={item.id} type="button" className={section===item.id?'active':''} onClick={()=>setSection(item.id)} aria-current={section===item.id?'page':undefined}><Icon size={18}/><span>{item.label}</span><span className="cd-nav-num">{String(index+1).padStart(2,'0')}</span>{item.id==='verifications'&&reviewQueue.length>0&&<b className="cd-count">{reviewQueue.length}</b>}</button>})}
              </div>
              <div className="cd-nav-group"><div className="cd-nav-label">AI &amp; Delivery</div>
                {SECTIONS.slice(4,6).map((item,index)=>{const Icon=item.icon;return <button key={item.id} type="button" className={section===item.id?'active':''} onClick={()=>setSection(item.id)} aria-current={section===item.id?'page':undefined}><Icon size={18}/><span>{item.label}</span><span className="cd-nav-num">{String(index+5).padStart(2,'0')}</span></button>})}
              </div>
              <div className="cd-nav-group"><div className="cd-nav-label">Platform</div>
                {SECTIONS.slice(6).map((item,index)=>{const Icon=item.icon;return <button key={item.id} type="button" className={section===item.id?'active':''} onClick={()=>setSection(item.id)} aria-current={section===item.id?'page':undefined}><Icon size={18}/><span>{item.label}</span><span className="cd-nav-num">{String(index+7).padStart(2,'0')}</span></button>})}
              </div>
            </nav>
            <p className="cd-keys">Keyboard: <kbd>1–9</kbd> sections · <kbd>⌘K</kbd> search</p>
            <div className="cd-rail-foot"><strong><i/> Preview mode</strong><p>Sample metrics and browser-only actions. Production records are not changed here.</p></div>
            <div className="cd-rail-user"><span className="cd-avatar">{(user.name?.[0]||user.email[0]||'A').toUpperCase()}</span><span className="cd-user-lines"><strong>{user.name||user.email}</strong><small>{user.email}</small></span></div>
            <button type="button" className="cd-signout" onClick={onSignOut}><LogOut size={16}/> Sign out</button>
          </motion.aside>
          <div className="cd-main">
            <header className="cd-topbar"><div><p className="cd-eyebrow">Command deck · KashNode platform</p><h1>{sectionTitle}</h1><p className="cd-page-subtitle">The whole business at a glance — merchants, payments, AI, courier and connected boxes.</p></div>
              <div className="cd-top-actions"><button type="button" className="cd-search-btn" onClick={()=>setPaletteOpen(true)}><Search size={16}/> Search <kbd>⌘K</kbd></button><a className="cd-top-link" href="/dashboard">Merchant dashboard <ArrowUpRight size={15}/></a></div>
            </header>
          {!isAdmin && (
            <div className="cd-role-banner" role="note">You are signed in as “{user.role || 'user'}”, not as a super-admin. Real admin actions must be enforced server-side for role <code>admin</code> before they go live.</div>
          )}
          {notice && (
            <div className="cd-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>Dismiss</button></div>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={section} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
              {section === 'overview' && (
                <section className="cd-section" aria-label="Overview">
                  <div className="cd-hero">
                    <div className="cd-hero-main">
                      <div className="cd-hero-eyebrow"><i/> November cycle · package value</div>
                      <div className="cd-hero-revenue">{formatBdt(totalRevenue)}<small> /month</small></div>
                      <p className="cd-hero-copy">Estimated monthly package value from <strong>{activeMerchants.length} active merchants</strong>. All figures are sample preview data, not live financial reporting.</p>
                      <div className="cd-hero-gauges">
                        <Gauge label="Active merchant share" value={Math.round(activeMerchants.length/Math.max(merchants.length,1)*100)} display={`${Math.round(activeMerchants.length/Math.max(merchants.length,1)*100)}%`}/>
                        <Gauge label="MFS match sample" value={96.4} display="96.4%"/>
                        <Gauge label="Parcel delivery sample" value={78} display="78%"/>
                      </div>
                    </div>
                    <div className="cd-hero-network">
                      <h2>The Kash network <span>6 BOXES · {merchants.length} MERCHANTS · 1 BRAIN</span></h2>
                      <svg viewBox="0 0 340 214" role="img" aria-label="Sample network diagram showing six KashNode Boxes, one offline">
                        <g className="cd-network-links"><line x1="170" y1="105" x2="52" y2="38"/><line x1="170" y1="105" x2="170" y2="24"/><line x1="170" y1="105" x2="288" y2="38"/><line x1="170" y1="105" x2="46" y2="172"/><line className="offline" x1="170" y1="105" x2="170" y2="188"/><line className="idle" x1="170" y1="105" x2="292" y2="170"/></g>
                        <circle cx="170" cy="105" r="27" className="cd-network-core"/><circle cx="170" cy="105" r="38" className="cd-network-ring"/>
                        <text x="170" y="101" textAnchor="middle" className="cd-network-brand">KASH</text><text x="170" y="117" textAnchor="middle" className="cd-network-caption">AI BRAIN</text>
                        <g className="cd-network-nodes"><circle cx="52" cy="38" r="6"/><text x="52" y="20">KN-BOX-01</text><circle cx="170" cy="24" r="6"/><text x="170" y="10">KN-BOX-02</text><circle cx="288" cy="38" r="6"/><text x="288" y="20">KN-BOX-03</text><circle cx="46" cy="172" r="6"/><text x="46" y="194">KN-BOX-05</text><circle className="offline" cx="170" cy="188" r="6"/><text className="offline-text" x="170" y="208">KN-BOX-04 · OFFLINE</text><circle className="idle" cx="292" cy="170" r="6"/><text className="idle-text" x="292" y="192">KN-BOX-06 · IDLE</text></g>
                      </svg>
                      <p className="cd-panel-note">Box status shown from the sample preview set. Live telemetry must come from registered device records.</p>
                      <div className="cd-live-line"><small>HAPPENING NOW · SAMPLE FEED</small><p>{LIVE_FEED[feedIndex]}</p></div>
                    </div>
                  </div>

                  <div className="cd-stats">
                    <TiltCard ghost="৳"><span className="cd-stat-icon"><CircleDollarSign size={22}/></span><small>Monthly package value</small><strong>{formatBdt(totalRevenue)}<span> /month</span></strong><p>Sum of active merchant package prices in this preview.</p></TiltCard>
                    <TiltCard ghost="08"><span className="cd-stat-icon cyan"><Users size={22}/></span><small>Active merchants</small><strong>{activeMerchants.length}<span> / {merchants.length} total</span></strong><p>{merchants.filter((item)=>item.status==='trial').length} on trial · {merchants.filter((item)=>item.status==='suspended').length} suspended.</p></TiltCard>
                    <TiltCard ghost="AI"><span className="cd-stat-icon pink"><Wallet size={22}/></span><small>AI minutes remaining</small><strong>{merchants.reduce((sum,item)=>sum+item.minutesLeft,0).toLocaleString('en-US')}<span> min</span></strong><p>Combined available minutes across sample merchants.</p></TiltCard>
                    <TiltCard ghost="KN"><span className="cd-stat-icon amber"><Box size={22}/></span><small>Connected boxes</small><strong>{connectedBoxes}<span> / {boxes.length} online</span></strong><p>{boxes.length-connectedBoxes} offline or inactive in this sample set.</p></TiltCard>
                  </div>

                  <div className="cd-overview-grid">
                    <div className="cd-panel cd-chart-panel">
                      <div className="cd-card-heading"><div><h2>Revenue &amp; AI minutes · last 14 days</h2><p>Illustrative trend only — no live transaction series is connected to this screen.</p></div><span className="cd-preview-chip">SAMPLE CHART</span></div>
                      <svg className="cd-chart" viewBox="0 0 640 240" role="img" aria-label="Illustrative sample revenue and AI usage trend">
                        <defs><linearGradient id="cdChartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1ce8ab" stopOpacity=".28"/><stop offset="100%" stopColor="#1ce8ab" stopOpacity="0"/></linearGradient></defs>
                        <g className="cd-chart-grid"><line x1="44" y1="30" x2="620" y2="30"/><line x1="44" y1="85" x2="620" y2="85"/><line x1="44" y1="140" x2="620" y2="140"/><line x1="44" y1="195" x2="620" y2="195"/></g>
                        <g className="cd-chart-labels"><text x="6" y="34">৳4k</text><text x="6" y="89">৳3k</text><text x="6" y="144">৳2k</text><text x="6" y="199">৳1k</text><text x="44" y="222">Oct 23</text><text x="230" y="222">Oct 29</text><text x="420" y="222">Nov 2</text><text x="580" y="222">Nov 5</text></g>
                        <path d="M44 139 L88 113 L132 148 L176 91 L220 126 L264 65 L308 109 L352 139 L396 78 L440 122 L484 47 L528 100 L572 131 L620 83 L620 205 L44 205 Z" fill="url(#cdChartFill)"/>
                        <path className="cd-chart-revenue" d="M44 139 L88 113 L132 148 L176 91 L220 126 L264 65 L308 109 L352 139 L396 78 L440 122 L484 47 L528 100 L572 131 L620 83"/>
                        <path className="cd-chart-minutes" d="M44 179 L88 168 L132 182 L176 159 L220 173 L264 149 L308 166 L352 179 L396 154 L440 172 L484 142 L528 163 L572 175 L620 156"/>
                      </svg>
                      <div className="cd-chart-legend"><span><i/> Revenue (sample)</span><span><i/> AI minutes (sample)</span></div>
                    </div>
                    <div className="cd-panel cd-attention-panel">
                      <div className="cd-card-heading"><div><h2>Needs attention</h2><p>Items derived from current sample records.</p></div><span className="cd-preview-chip warn">{boxes.filter((item)=>!item.online).length+reviewQueue.length} OPEN</span></div>
                      <ul className="cd-attention-list">
                        {boxes.filter((item)=>!item.online).map((box)=><li key={box.unit} className="bad"><span className="cd-attention-mark"><Signal size={16}/></span><span><strong>{box.unit} offline</strong><small>{box.merchant} · last sync {box.lastSync}</small></span></li>)}
                        {reviewQueue.length>0&&<li className="warn"><span className="cd-attention-mark"><ShieldCheck size={16}/></span><span><strong>{reviewQueue.length} reviews waiting</strong><small>Manual payment / verification review in sample queue.</small></span></li>}
                        {merchants.filter((item)=>item.status==='trial'&&item.minutesLeft<=10).map((merchant)=><li key={merchant.id} className="warn"><span className="cd-attention-mark"><Clock3 size={16}/></span><span><strong>{merchant.name} · trial nearly used</strong><small>{merchant.minutesLeft} minutes remain in the sample plan.</small></span></li>)}
                        {CALL_ROWS.filter((call)=>call.outcome.toLowerCase().includes('failed')).map((call)=><li key={call.id} className="info"><span className="cd-attention-mark"><Phone size={16}/></span><span><strong>{call.id} · call follow-up</strong><small>{call.merchant} · {call.outcome}</small></span></li>)}
                      </ul>
                      <div className="cd-quick-actions"><button type="button" onClick={()=>setSection('verifications')}>Review verifications ({reviewQueue.length}) <ArrowUpRight size={15}/></button><button type="button" onClick={()=>setSection('hardware')}>Inspect hardware boxes <ArrowUpRight size={15}/></button></div>
                    </div>
                  </div>

                  <div className="cd-mini-grid">
                    <div className="cd-panel"><h2>Merchant lifecycle</h2><div className="cd-row-between"><span>Active</span><strong>{activeMerchants.length}</strong></div><div className="cd-meter"><i style={{width:`${activeMerchants.length/Math.max(merchants.length,1)*100}%`}}/></div><div className="cd-row-between"><span>Trial</span><strong>{merchants.filter((item)=>item.status==='trial').length}</strong></div><div className="cd-meter warn"><i style={{width:`${merchants.filter((item)=>item.status==='trial').length/Math.max(merchants.length,1)*100}%`}}/></div><div className="cd-row-between"><span>Suspended</span><strong>{merchants.filter((item)=>item.status==='suspended').length}</strong></div><div className="cd-meter bad"><i style={{width:`${merchants.filter((item)=>item.status==='suspended').length/Math.max(merchants.length,1)*100}%`}}/></div></div>
                    <div className="cd-panel"><h2>Box connectivity</h2><div className="cd-row-between"><span>Online now (sample)</span><strong>{connectedBoxes} / {boxes.length}</strong></div><div className="cd-meter"><i style={{width:`${connectedBoxes/Math.max(boxes.length,1)*100}%`}}/></div><div className="cd-box-summary"><span><i className="online"/> Online <strong>{connectedBoxes}</strong></span><span><i className="offline"/> Offline <strong>{boxes.length-connectedBoxes}</strong></span></div><p className="cd-panel-note">Signal, SIM balance and last sync are preview values until live device telemetry is wired in.</p></div>
                    <div className="cd-panel"><h2>Minutes at risk</h2>{merchants.slice().sort((x,y)=>x.minutesLeft-y.minutesLeft).slice(0,3).map((merchant)=>{const total=packageById(merchant.packageId).minutes;const pct=total>0?Math.max(0,Math.min(100,merchant.minutesLeft/total*100)):0;return <div className="cd-risk-row" key={merchant.id}><div className="cd-row-between"><span>{merchant.name}</span><strong>{merchant.minutesLeft.toLocaleString('en-US')} min left</strong></div><div className="cd-meter warn"><i style={{width:`${pct}%`}}/></div></div>})}</div>
                  </div>
                </section>
              )}

              {section === 'merchants' && (
                <section className="cd-section" aria-label="Merchants">
                  <div className="cd-filters">
                    <label className="cd-search"><Search size={17} /><input type="search" placeholder="Search merchant, email or ID…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                    <label className="cd-filter"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | MerchantStatus)}><option value="all">All statuses</option><option value="active">Active</option><option value="trial">Trial</option><option value="suspended">Suspended</option></select></label>
                    <span className="cd-count">{filteredMerchants.length} merchants</span>
                  </div>
                  <div className="cd-table-wrap">
                    <table className="cd-table">
                      <thead><tr><th>Merchant</th><th>Package</th><th>Status</th><th>Boxes</th><th>Minutes left</th><th>Actions</th></tr></thead>
                      <tbody>
                        <AnimatePresence>
                          {filteredMerchants.map((merchant, index) => (
                            <motion.tr key={merchant.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, delay: index * 0.03 }}>
                              <td><strong>{merchant.name}</strong><small>{merchant.email}</small><small>{merchant.id}</small></td>
                              <td>
                                <select className="cd-package-select" aria-label={`Package for ${merchant.name}`} value={merchant.packageId} onChange={(event) => changePackage(merchant.id, event.target.value as PackageId)}>
                                  {PACKAGES.map((item) => (<option key={item.id} value={item.id}>{item.name} · {formatBdt(item.price)}/mo</option>))}
                                </select>
                              </td>
                              <td><span className={`cd-status ${merchant.status}`}>{merchant.status}</span></td>
                              <td>{merchant.boxes}</td>
                              <td>{merchant.minutesLeft.toLocaleString('en-US')} min</td>
                              <td><button type="button" className="cd-action" onClick={() => toggleSuspend(merchant)}>{merchant.status === 'suspended' ? <><Play size={14} /> Reactivate</> : <><Pause size={14} /> Suspend</>}</button></td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                        {filteredMerchants.length === 0 && (<tr><td colSpan={6} className="cd-empty">No merchants match this search.</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {section === 'minutes' && (
                <section className="cd-section" aria-label="Minutes and billing">
                  <div className="cd-table-wrap">
                    <table className="cd-table">
                      <thead><tr><th>Merchant</th><th>Package minutes</th><th>Used</th><th>Left</th><th>Overage</th></tr></thead>
                      <tbody>
                        {merchants.map((merchant) => {
                          const total = packageById(merchant.packageId).minutes
                          const used = Math.max(0, total - merchant.minutesLeft)
                          return (
                            <tr key={merchant.id}>
                              <td><strong>{merchant.name}</strong><small>{packageById(merchant.packageId).name}</small></td>
                              <td>{total.toLocaleString('en-US')} min</td>
                              <td>{used.toLocaleString('en-US')} min</td>
                              <td>{merchant.minutesLeft.toLocaleString('en-US')} min</td>
                              <td>৳0 · flat ৳7/min overage when minutes run out</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="cd-panel cd-wallet">
                    <h2>Wallet activity (sample)</h2>
                    <ul className="cd-list">
                      {WALLET_ROWS.map((row) => (<li key={`${row.date}-${row.merchant}`}><span><strong>{row.merchant}</strong><small>{row.detail}</small></span><span>{row.date}</span><strong>{row.amount}</strong></li>))}
                    </ul>
                    <p className="cd-panel-note">Overage is a flat ৳7/minute, with in-app minute recharge.</p>
                  </div>
                </section>
              )}

              {section === 'verifications' && (
                <section className="cd-section" aria-label="Verifications">
                  <div className="cd-stats cd-stats-3">
                    <TiltCard ghost="✓"><small>COD SMS verified today</small><strong>128</strong><p>Sample count for this preview.</p></TiltCard>
                    <TiltCard ghost="!"><small>Fake orders blocked</small><strong>17</strong><p>Failed or unverified COD attempts in this sample set.</p></TiltCard>
                    <TiltCard ghost="96"><small>MFS TrxID matched</small><strong>96.4%</strong><p>bKash, Nagad, Rocket and Upay in this sample set.</p></TiltCard>
                  </div>
                  <div className="cd-panel">
                    <h2>Manual review queue — {reviewQueue.length} waiting</h2>
                    {reviewQueue.length === 0 && <p className="cd-panel-note">Queue cleared in this view (browser only).</p>}
                    <ul className="cd-list">
                      {reviewQueue.map((item) => (
                        <li key={item.id}>
                          <span><strong>{item.id} · {item.merchant}</strong><small>{item.channel} · {formatBdt(item.amount)} · {item.detail}</small></span>
                          <span className="cd-row-actions">
                            <button type="button" className="cd-action" onClick={() => reviewItem(item, 'approved')}><Check size={14} /> Approve</button>
                            <button type="button" className="cd-action danger" onClick={() => reviewItem(item, 'rejected')}><X size={14} /> Reject</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {section === 'calls' && (
                <section className="cd-section" aria-label="Kash AI calls">
                  <div className="cd-stats cd-stats-3">
                    <TiltCard ghost="37"><small>Kash AI calls today</small><strong>37</strong><p>Sample count for this preview.</p></TiltCard>
                    <TiltCard ghost="✓"><small>Confirmed by call</small><strong>31</strong><p>Orders confirmed after a Kash phone call.</p></TiltCard>
                    <TiltCard ghost="!"><small>Failed calls</small><strong>6</strong><p>No answer or call dropped in this sample set.</p></TiltCard>
                  </div>
                  <div className="cd-table-wrap">
                    <table className="cd-table">
                      <thead><tr><th>Call</th><th>Merchant</th><th>Outcome</th><th>Minutes</th><th>Kash voice</th></tr></thead>
                      <tbody>
                        {CALL_ROWS.map((call) => (
                          <tr key={call.id}>
                            <td><strong>{call.id}</strong></td>
                            <td>{call.merchant}</td>
                            <td>{call.outcome}</td>
                            <td>{call.minutes} min</td>
                            <td><button type="button" className="cd-action" onClick={() => toggleVoice(call.merchant)}>{voices[call.merchant] ?? call.voice} voice · Switch</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="cd-panel-note">Voice changes here update only this browser view (demo only).</p>
                </section>
              )}

              {section === 'courier' && (
                <section className="cd-section" aria-label="Courier">
                  <div className="cd-table-wrap">
                    <table className="cd-table">
                      <thead><tr><th>Parcel</th><th>Merchant</th><th>Courier</th><th>Status</th><th>Rider PIN</th></tr></thead>
                      <tbody>
                        {COURIER_ROWS.map((row) => (
                          <tr key={row.id}><td><strong>{row.id}</strong></td><td>{row.merchant}</td><td>{row.courier}</td><td>{row.status}</td><td>{row.pin}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="cd-panel-note">Steadfast and Pathao parcels in one place — sample rows for this preview.</p>
                </section>
              )}

              {section === 'hardware' && (
                <section className="cd-section" aria-label="Hardware boxes">
                  <div className="cd-box-grid">
                    {boxes.map((box, index) => (
                      <motion.article key={box.unit} className="cd-box-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }} whileHover={{ y: -6 }}>
                        <div className="cd-box-head">
                          <span className="cd-box-icon"><Signal size={20} /></span>
                          <span className={`cd-status ${box.online ? 'active' : 'suspended'}`}>{box.online ? 'Online' : 'Offline'}</span>
                        </div>
                        <h2>{box.unit}</h2>
                        <p>{box.merchant}</p>
                        <dl>
                          <div><dt>SIM</dt><dd>{box.sim}</dd></div>
                          <div><dt>SIM balance</dt><dd>{formatBdt(box.simBalance)}</dd></div>
                          <div><dt>Signal</dt><dd><SignalBars level={box.signal} /> {box.signal}/5</dd></div>
                          <div><dt>Data</dt><dd>{box.dataMb.toLocaleString('en-US')} MB</dd></div>
                          <div><dt>WebSocket</dt><dd>{box.online ? `${box.latencyMs} ms` : '—'}</dd></div>
                          <div><dt>SMS today</dt><dd>{box.smsToday}</dd></div>
                          <div><dt>Last sync</dt><dd>{box.lastSync}</dd></div>
                        </dl>
                        {!box.online && <p className="cd-offline-alert">Offline alert: this box has not synced for 3 hours in this sample set.</p>}
                      </motion.article>
                    ))}
                  </div>
                </section>
              )}

              {section === 'licensing' && (
                <section className="cd-section" aria-label="Licensing and packages">
                  <div className="cd-package-grid">
                    {PACKAGES.map((item, index) => (
                      <motion.article key={item.id} className="cd-package-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.06 }} whileHover={{ y: -6, scale: 1.01 }}>
                        <span className="cd-package-note">{item.note}</span>
                        <h2>{item.name}</h2>
                        <strong className="cd-package-price">{formatBdt(item.price)}<span>/month</span></strong>
                        <ul>
                          <li>{item.orders.toLocaleString('en-US')} orders / month</li>
                          <li>{item.minutes.toLocaleString('en-US')} AI minutes included</li>
                          <li>Overage: flat ৳7 / minute</li>
                          <li>{merchants.filter((merchant) => merchant.packageId === item.id).length} merchants on this package (demo)</li>
                        </ul>
                        <button type="button" onClick={() => setSection('merchants')}>Assign in Merchants <ArrowUpRight size={15} /></button>
                      </motion.article>
                    ))}
                  </div>
                  <p className="cd-panel-note">Licensing model: a monthly order package with minutes included inside it — cost is per minute, but sellers budget per order.</p>
                </section>
              )}

              {section === 'system' && (
                <section className="cd-section" aria-label="System and audit">
                  <div className="cd-panel">
                    <h2>Service health (sample)</h2>
                    <ul className="cd-list">
                      <li><span><strong>Central Server</strong><small>Node.js + Asterisk</small></span><span className="cd-status active">Operational</span></li>
                      <li><span><strong>AI API (STT / LLM / TTS)</strong><small>Kash voice brain</small></span><span className="cd-status active">Operational</span></li>
                      <li><span><strong>Supabase database</strong><small>Orders, merchants, calls</small></span><span className="cd-status active">Operational</span></li>
                      <li><span><strong>Edge WebSocket</strong><small>KashNode Box connections</small></span><span className="cd-status suspended">Degraded — 1 box offline</span></li>
                    </ul>
                  </div>
                  <div className="cd-panel">
                    <h2>Admin action log (this browser session)</h2>
                    <ul className="cd-list">
                      {auditLog.map((entry, index) => (<li key={`${index}-${entry}`}><span>{entry}</span></li>))}
                    </ul>
                    <p className="cd-panel-note">Package, suspend, voice and review actions above are appended here in this view only — no server audit trail exists yet.</p>
                  </div>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {paletteOpen && (
        <div className="cd-palette-backdrop" onClick={() => setPaletteOpen(false)}>
          <div className="cd-palette" role="dialog" aria-label="Command search" onClick={(event) => event.stopPropagation()}>
            <label className="cd-search"><Search size={17} /><input ref={paletteInputRef} type="search" placeholder="Search sections or merchants… (Esc to close)" value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} /></label>
            <div className="cd-palette-list">
              {SECTIONS.map((item, index) => (
                <button key={item.id} type="button" onClick={() => { setSection(item.id); setPaletteOpen(false) }}><span>{index + 1}</span> {item.label}</button>
              ))}
              {paletteMerchants.map((merchant) => (
                <button key={merchant.id} type="button" onClick={() => { setSearch(merchant.name); setSection('merchants'); setPaletteOpen(false) }}>Merchant · {merchant.name} ({merchant.id})</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
