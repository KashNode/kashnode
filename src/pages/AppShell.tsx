import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  Activity, ArrowDownLeft, ArrowUpRight, AudioLines, Bell, Bot, Check, ChevronDown,
  CircleDollarSign, Clock3, CreditCard, Headphones, LayoutDashboard, LogOut, MoreHorizontal,
  PackageCheck, Pause, Play, Radio, RefreshCw, Settings, ShieldCheck, ShoppingBag, Signal,
  Smartphone, Sparkles, TrendingUp, Wallet, Wifi, X, Palette,
} from 'lucide-react'
import type { AuthUser } from '../lib/auth'
import { getCallHistory, getSimStatus, getSimUssdSettings, saveSimUssdSettings, type CallHistoryEntry, type SimStatus, type SimUssdSettings } from '../lib/kashApi'
import { CourierTrackingWidget } from '../components/CourierTrackingWidget'
import KashNodeLogo from '../components/KashNodeLogo'
import { AppearanceDrawer, AppearancePage, SettingsTabs } from '../components/AppearanceControls'

type Module = 'Dashboard' | 'AI Controls' | 'History' | 'Settings'
type Props = { user: AuthUser; onSignOut: () => void }

const navItems: { label: Module; path: string; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }, { label: 'AI Controls', path: '/ai-controls', icon: Bot },
  { label: 'History', path: '/history', icon: Clock3 }, { label: 'Settings', path: '/settings', icon: Settings },
]

function AppShell({ user, onSignOut }: Props) {
  const location = useLocation()
  const active: Module = location.pathname.startsWith('/ai-controls') ? 'AI Controls' : location.pathname.startsWith('/history') ? 'History' : location.pathname.startsWith('/settings') ? 'Settings' : 'Dashboard'
  const [notice, setNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)

  function notify(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 2800) }
  const firstName = user.name?.split(' ')[0] || user.email.split('@')[0]

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <NavLink className="brand-lockup" to="/dashboard" aria-label="KashNode dashboard"><KashNodeLogo /></NavLink>
        <div className="workspace-switch"><span className="workspace-avatar">F</span><span><strong>Faz Network</strong><small>Business workspace</small></span><ChevronDown size={15} /></div>
        <span className="nav-caption">WORKSPACE</span>
        <nav className="side-nav" aria-label="Main navigation">{navItems.map(item => <NavButton key={item.label} item={item} />)}</nav>
        <div className="sidebar-bottom"><div className="support-card"><span className="support-icon"><Headphones size={17} /></span><strong>Need a hand?</strong><small>Our team is here to help.</small><button onClick={() => notify('Support options are coming soon.')}>Contact support <ArrowUpRight size={13} /></button></div><button className="side-user" onClick={() => setMenuOpen(value => !value)}><span className="user-avatar">{firstName.slice(0, 1).toUpperCase()}</span><span className="user-lines"><strong>{user.name || firstName}</strong><small>{user.email}</small></span><MoreHorizontal size={17} /></button>{menuOpen && <button className="signout-menu" onClick={onSignOut}><LogOut size={15} /> Sign out</button>}</div>
      </aside>

      <div className="main-column">
        <header className="topbar"><div><span className="workspace-breadcrumb">Faz Network <span>/</span></span><strong>{active}</strong></div><div className="topbar-actions"><span className="live-pill"><i /> All systems operational</span><button className="icon-button notification-button" aria-label="Notifications" onClick={() => notify('You’re all caught up.')}><Bell size={18} /><i /></button><button className="appearance-trigger" type="button" onClick={() => setAppearanceOpen(true)} aria-haspopup="dialog" aria-expanded={appearanceOpen} aria-label="Open display and theme settings"><Palette size={17} /><span>Display &amp; Theme</span></button><button className="top-avatar" aria-label="Open account menu" onClick={() => setMenuOpen(value => !value)}>{firstName.slice(0, 1).toUpperCase()}</button>{menuOpen && <button className="top-signout" onClick={onSignOut}><LogOut size={15} /> Sign out</button>}</div></header>
        {appearanceOpen && <AppearanceDrawer onClose={() => setAppearanceOpen(false)} />}
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard firstName={firstName} notify={notify} />} />
            <Route path="/ai-controls" element={<AIControls notify={notify} />} />
            <Route path="/history" element={<History notify={notify} activeTab="all" />} />
            <Route path="/history/payments" element={<History notify={notify} activeTab="payments" />} />
            <Route path="/history/calls" element={<History notify={notify} activeTab="calls" />} />
            <Route path="/settings" element={<><SettingsPage notify={notify} /><SimUssdSettings notify={notify} /></>} />
            <Route path="/settings/appearance" element={<AppearancePage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
        <nav className="mobile-nav" aria-label="Main navigation">{navItems.map(item => <NavButton key={item.label} item={item} mobile />)}</nav>
      </div>
    </div>
  )
}

function NavButton({ item, mobile = false }: { item: (typeof navItems)[number]; mobile?: boolean }) {
  const { pathname } = useLocation()
  const Icon = item.icon
  const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(`${item.path}/`))
  return <NavLink to={item.path} end={item.path === '/dashboard'} className={`${mobile ? 'mobile-nav-item' : 'side-nav-item'} ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}><Icon size={19} strokeWidth={active ? 2.2 : 1.8} /><span>{item.label}</span></NavLink>
}

function PageIntro({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-intro"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}

function Dashboard({ firstName, notify }: { firstName: string; notify: (message: string) => void }) {
  const [simRefreshing, setSimRefreshing] = useState(false)
  const [simStatus, setSimStatus] = useState<SimStatus | null>(null)
  const [simError, setSimError] = useState('')
  async function refreshSimStatus(quiet = false) {
    setSimRefreshing(true)
    setSimError('')
    try { setSimStatus(await getSimStatus()); if (!quiet) notify('SIM status refreshed.') }
    catch (error) { setSimError(error instanceof Error ? error.message : 'Could not load SIM status.') }
    finally { setSimRefreshing(false) }
  }
  useEffect(() => { void refreshSimStatus(true) }, [])
  return <>
    <PageIntro eyebrow="MONDAY, NOVEMBER 3, 2026" title={`Good morning, ${firstName}`} subtitle="Here’s the latest from your payment and commerce operations." action={<button className="secondary-button" onClick={() => notify('Your latest workspace data is up to date.')}><Activity size={16} /> Live overview <span className="live-dot" /></button>} />
    <section className="metric-grid" aria-label="Today's performance">
      <MetricCard title="Verified payments" amount="৳ 48,620" change="+12.8%" description="vs. previous day" icon={<CircleDollarSign size={19} />} kind="mint" trend={<Sparkline points="4,38 18,28 32,32 46,19 60,25 74,12 90,16 106,4" />} />
      <MetricCard title="AI calls handled" amount="128" change="+8.2%" description="vs. previous day" icon={<AudioLines size={19} />} kind="blue" trend={<Sparkline points="4,35 18,30 32,34 46,16 60,22 74,11 90,17 106,7" />} />
      <MetricCard title="Orders matched" amount="94.6%" change="+2.4%" description="match rate today" icon={<PackageCheck size={19} />} kind="peach" trend={<Sparkline points="4,34 18,26 32,31 46,22 60,24 74,12 90,18 106,5" />} />
    </section>
    <section className="dashboard-grid">
      <article className="wallet-card">
        <div className="wallet-head"><span className="wallet-icon"><Wallet size={19} /></span><span className="wallet-label">AVAILABLE BALANCE</span><button className="wallet-more" aria-label="Wallet options" onClick={() => notify('Wallet options are coming soon.')}>•••</button></div>
        <div className="wallet-balance">৳ 24,850<span>.00</span></div>
        <div className="wallet-foot"><span><i /> Ready for operations</span><button className="recharge-button" onClick={() => notify('Recharge can be connected to your payment provider.')}>Recharge <ArrowUpRight size={15} /></button></div>
        <div className="wallet-orbit orbit-one" /><div className="wallet-orbit orbit-two" />
      </article>
      <article className="panel health-panel">
        <div className="panel-heading"><div><span className="eyebrow">INFRASTRUCTURE</span><h2>Device health</h2></div><button className="icon-button" aria-label="Device details" onClick={() => notify('Device details will appear here.')}><MoreHorizontal size={19} /></button></div>
        <div className="device-row"><span className="device-icon"><Smartphone size={19} /></span><span className="device-copy"><strong>Gateway device</strong><small>PaySync · Android gateway</small></span><span className="status-badge status-online"><i /> Online</span></div>
        <div className="device-row"><span className="device-icon modem"><Wifi size={19} /></span><span className="device-copy"><strong>Primary modem</strong><small>Uptime 12d 04h · Signal strong</small></span><span className="status-badge status-online"><i /> Healthy</span></div>
        <div className="health-footer"><span>Last checked <strong>just now</strong></span><span className="health-bars"><i /><i /><i /><i /><i /></span></div>
      </article>
    </section>
    <SimStatusWidget status={simStatus} error={simError} refreshing={simRefreshing} onRefresh={() => void refreshSimStatus()} />
    <CourierTrackingWidget />
    <section className="lower-grid">
      <article className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">PAYMENT ACTIVITY</span><h2>Verified volume</h2></div><button className="select-button" onClick={() => notify('Showing the last 7 days.')}>Last 7 days <ChevronDown size={14} /></button></div><div className="chart-total"><strong>৳ 3,84,290</strong><span className="positive"><TrendingUp size={14} /> 14.2%</span><small>compared with last week</small></div><div className="chart"><div className="chart-y"><span>৳80k</span><span>৳60k</span><span>৳40k</span><span>৳20k</span><span>৳0</span></div><div className="chart-plot"><div className="chart-lines"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 700 176" preserveAspectRatio="none" role="img" aria-label="Payment volume over the last seven days"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#70b5a0" stopOpacity=".20" /><stop offset="1" stopColor="#70b5a0" stopOpacity="0" /></linearGradient></defs><path d="M0 130 C45 126,60 109,100 114 S155 126,200 93 S260 83,300 96 S355 70,400 79 S460 85,500 47 S560 65,600 38 S655 42,700 18 L700 176 L0 176 Z" fill="url(#chart-fill)" /><path d="M0 130 C45 126,60 109,100 114 S155 126,200 93 S260 83,300 96 S355 70,400 79 S460 85,500 47 S560 65,600 38 S655 42,700 18" fill="none" stroke="#368b75" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg><div className="chart-x"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></div></article>
      <article className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Latest updates</h2></div><button className="subtle-link" onClick={() => notify('Open History to see all activity.')}>View all <ArrowUpRight size={13} /></button></div><div className="activity-list"><ActivityRow icon={<ArrowDownLeft size={16} />} kind="success" title="Payment verified" sub="Order #KN-48219 · bKash" amount="৳ 1,250" time="2 min ago" /><ActivityRow icon={<AudioLines size={16} />} kind="voice" title="AI call completed" sub="Customer ending 8291" amount="Renewed" time="8 min ago" /><ActivityRow icon={<ShoppingBag size={16} />} kind="pending" title="Needs review" sub="TrxID: 9FK2D1 · Nagad" amount="৳ 890" time="14 min ago" /></div></article>
    </section>
  </>
}

function SimStatusWidget({ status, error, refreshing, onRefresh }: { status: SimStatus | null; error: string; refreshing: boolean; onRefresh: () => void }) {
  const quotaMb = status?.dataQuotaMb || 1
  const dataPercent = status ? Math.max(0, Math.min(100, status.internetDataMb / quotaMb * 100)) : 0
  const dataRemaining = status ? status.internetDataMb >= 1024 ? `${(status.internetDataMb / 1024).toFixed(1)} GB` : `${Math.round(status.internetDataMb)} MB` : '—'
  const dataTotal = quotaMb >= 1024 ? `${(quotaMb / 1024).toFixed(0)} GB` : `${Math.round(quotaMb)} MB`
  const checked = status ? new Date(status.updatedAt).toLocaleString() : 'Waiting for device data'
  const signal = status ? Math.max(0, Math.min(5, Math.round(status.signalStrength))) : 0
  return <section className="panel sim-status-card" aria-labelledby="sim-status-title">
    <div className="sim-status-header">
      <div className="sim-title-wrap"><span className="sim-card-icon"><Smartphone size={18} /></span><div><span className="eyebrow">KASHNODE BOX · SIM 1</span><h2 id="sim-status-title">SIM & network status</h2></div></div>
      <div className="sim-header-actions"><span className={`status-badge ${status?.online ? 'status-online' : 'unmatched'}`}><i /> {status ? status.online ? 'Device online' : 'Device offline' : 'Device status unavailable'}</span><button className="secondary-button sim-refresh" onClick={onRefresh} disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'refresh-spinning' : ''} /> {refreshing ? 'Refreshing' : 'Refresh'}</button></div>
    </div>
    {error && <div className="sim-status-error" role="alert">{error}</div>}
    <div className="sim-status-content">
      <div className="sim-balance-block"><span className="sim-stat-label">MAIN ACCOUNT BALANCE</span><strong className="sim-balance">{status ? `৳${status.balance.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</strong><small>Last checked {checked}{status?.source === 'demo' ? ' · Demo data' : ''}</small></div>
      <div className="sim-data-block"><div className="sim-data-heading"><span><strong>Internet data remaining</strong><small>{dataRemaining} <span>of</span> {dataTotal}</small></span><span className="sim-data-percent">{Math.round(dataPercent)}%</span></div><div className="sim-progress" role="progressbar" aria-label="Internet data remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(dataPercent)}><span style={{ width: `${dataPercent}%` }} /></div><div className="sim-data-foot"><span>{status ? `Used ${Math.max(0, quotaMb - status.internetDataMb) >= 1024 ? `${((quotaMb - status.internetDataMb) / 1024).toFixed(1)} GB` : `${Math.round(quotaMb - status.internetDataMb)} MB`}` : 'Usage unavailable'}</span><span>Device: {status?.deviceId || '—'}</span></div></div>
      <div className="sim-network-block"><div className="sim-network-top"><span className="sim-network-icon"><Signal size={17} /></span><span className={`status-badge ${status?.online ? 'status-online' : ''}`}>{status?.networkType || 'Network unavailable'}</span></div><strong>{signal >= 4 ? 'Strong signal' : signal >= 2 ? 'Moderate signal' : signal > 0 ? 'Weak signal' : 'No signal data'}</strong><div className="sim-signal-bars" aria-label={`Signal strength: ${signal} of 5`}>{[1, 2, 3, 4, 5].map(bar => <i key={bar} className={bar <= signal ? 'active' : ''} />)}</div><small>{status?.online ? 'SIM active · Network connected' : 'Awaiting KashNode Box update'}</small></div>
    </div>
  </section>
}

function MetricCard({ title, amount, change, description, icon, kind, trend }: { title: string; amount: string; change: string; description: string; icon: ReactNode; kind: string; trend: ReactNode }) {
  return <article className="metric-card"><div className="metric-top"><span className={`metric-icon ${kind}`}>{icon}</span><span className="metric-change"><TrendingUp size={12} /> {change}</span></div><div className="metric-amount">{amount}</div><div className="metric-bottom"><span><strong>{title}</strong><small>{description}</small></span>{trend}</div></article>
}
function Sparkline({ points }: { points: string }) { return <svg className="sparkline" viewBox="0 0 112 44" aria-hidden="true"><polyline points={points} fill="none" stroke="#6aa994" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function ActivityRow({ icon, kind, title, sub, amount, time }: { icon: ReactNode; kind: string; title: string; sub: string; amount: string; time: string }) { return <div className="activity-row"><span className={`activity-icon ${kind}`}>{icon}</span><span className="activity-copy"><strong>{title}</strong><small>{sub}</small></span><span className="activity-amount"><strong>{amount}</strong><small>{time}</small></span></div> }

function AIControls({ notify }: { notify: (message: string) => void }) {
  const [toggles, setToggles] = useState({ verify: true, cod: true, voice: false })
  const toggle = (key: keyof typeof toggles) => setToggles(value => ({ ...value, [key]: !value[key] }))
  return <><PageIntro eyebrow="AUTOMATION SETTINGS" title="AI Controls" subtitle="Choose what your AI handles, and stay close to every live interaction." /><div className="module-grid"><section className="panel controls-panel"><div className="panel-heading"><div><span className="eyebrow">AUTOMATION</span><h2>Active workflows</h2></div><span className="count-pill">{Object.values(toggles).filter(Boolean).length} active</span></div><ToggleRow icon={<CreditCard size={18} />} title="Automated Payment Verification" desc="Match incoming mobile payments to open orders." checked={toggles.verify} onChange={() => toggle('verify')} /><ToggleRow icon={<ShieldCheck size={18} />} title="Cash on Delivery OTP" desc="Confirm COD orders with a one-time code call." checked={toggles.cod} onChange={() => toggle('cod')} /><ToggleRow icon={<AudioLines size={18} />} title="AI Voice Assistant" desc="Handle routine payment and order calls automatically." checked={toggles.voice} onChange={() => toggle('voice')} last /></section><section className="panel call-monitor"><div className="panel-heading"><div><span className="eyebrow">LIVE CALL MONITORING</span><h2>Call in progress</h2></div><span className="status-badge status-live"><i /> LIVE</span></div><div className="caller-card"><span className="caller-avatar">R</span><span className="caller-meta"><strong>Rahim Uddin</strong><small>+880 17•• ••• 8291 · Order #KN-48203</small></span><span className="call-timer">02:18</span></div><div className="waveform">{Array.from({ length: 38 }, (_, index) => <i key={index} style={{ height: `${12 + ((index * 37 + 11) % 29)}px` }} />)}</div><div className="monitor-note"><Radio size={15} /> AI assistant is discussing a payment confirmation.</div><div className="monitor-actions"><button className="secondary-button" onClick={() => notify('Live listening is ready to connect to your voice provider.')}><Headphones size={15} /> Listen</button><button className="primary-button" onClick={() => notify('Take-over will connect to your telephony provider.')}><AudioLines size={15} /> Take over</button></div><p className="panel-footnote">Listening and call take-over require an active telephony integration.</p></section></div></>
}
function ToggleRow({ icon, title, desc, checked, onChange, last = false }: { icon: ReactNode; title: string; desc: string; checked: boolean; onChange: () => void; last?: boolean }) { return <div className={`toggle-row ${last ? 'last' : ''}`}><span className="toggle-icon">{icon}</span><span className="toggle-copy"><strong>{title}</strong><small>{desc}</small></span><button className={`switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={title} onClick={onChange}><i /></button></div> }

type HistoryTab = 'all' | 'payments' | 'calls'
type PaymentLog = { sender: string; detail: string; amount: string; trx: string; order: string; status: string; tone: string; channel: string; time: string }
type CallLog = { id: string; phone: string; timestamp: string; duration: string; status: string; summary: string; recordingUrl: string | null }

const paymentLogs: PaymentLog[] = [
  { sender: 'Nusrat Jahan', detail: '+880 18•• ••• 4221', amount: '৳ 2,450', trx: 'B8K2F1L9Q', order: '#KN-48219', status: 'Matched', tone: 'matched', channel: 'bKash', time: '10:42 AM' },
  { sender: 'Mahmud Hasan', detail: '+880 16•• ••• 7084', amount: '৳ 1,200', trx: '9FK2D1R7P', order: 'Needs matching', status: 'Unmatched', tone: 'unmatched', channel: 'Nagad', time: '10:31 AM' },
  { sender: 'Tania Akter', detail: '+880 19•• ••• 3190', amount: '৳ 890', trx: 'A4P7M2X6C', order: '#KN-48217', status: 'Matched', tone: 'matched', channel: 'Rocket', time: '10:18 AM' },
  { sender: 'Sabbir Ahmed', detail: '+880 17•• ••• 9608', amount: '৳ 3,600', trx: 'C6L1N5W8B', order: '#KN-48216', status: 'Matched', tone: 'matched', channel: 'bKash', time: '09:56 AM' },
]

function History({ notify, activeTab }: { notify: (message: string) => void; activeTab: HistoryTab }) {
  const [approved, setApproved] = useState(false)
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [callHistorySource, setCallHistorySource] = useState<'demo' | 'database' | null>(null)
  const [callsError, setCallsError] = useState('')
  useEffect(() => {
    let alive = true
    getCallHistory().then(payload => {
      if (!alive) return
      setCallHistorySource(payload.source)
      setCallLogs(payload.calls.map((call: CallHistoryEntry) => ({
        id: call.id,
        phone: call.phone,
        timestamp: new Date(call.occurredAt).toLocaleString(),
        duration: `${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, '0')}`,
        status: call.status,
        summary: call.summary,
        recordingUrl: call.recordingUrl,
      })))
    }).catch(error => { if (alive) setCallsError(error instanceof Error ? error.message : 'Could not load call history.') })
    return () => { alive = false }
  }, [])
  const rows = paymentLogs.map(row => row.trx === '9FK2D1R7P' && approved ? { ...row, status: 'Approved', tone: 'matched' } : row)
  const approvePayment = () => { setApproved(true); notify('Payment approved and matched.') }

  return <>
    <PageIntro eyebrow="ACTIVITY LOGBOOK" title="History" subtitle="Payment events and AI call outcomes, in one searchable timeline." action={<button className="secondary-button" onClick={() => notify('Export is being prepared.')}>Export log <ArrowUpRight size={15} /></button>} />
    <section className="panel history-panel">
      <div className="history-toolbar">
        <div className="history-tabs" role="tablist" aria-label="History categories">
          <NavLink to="/history" end role="tab" aria-selected={activeTab === 'all'} className={activeTab === 'all' ? 'selected' : ''}>All activity <span>24</span></NavLink>
          <NavLink to="/history/payments" role="tab" aria-selected={activeTab === 'payments'} className={activeTab === 'payments' ? 'selected' : ''}>Payments</NavLink>
          <NavLink to="/history/calls" role="tab" aria-selected={activeTab === 'calls'} className={activeTab === 'calls' ? 'selected' : ''}>Call history</NavLink>
        </div>
        <button className="select-button" onClick={() => notify('Date filter is ready.')}>Today <ChevronDown size={14} /></button>
      </div>
      {activeTab !== 'calls' && <div className="transaction-table-wrap"><table className="transaction-table"><thead><tr><th>Sender</th><th>Amount</th><th>TrxID</th><th>Matched order</th><th>Channel</th><th>Status</th><th /></tr></thead><tbody>{rows.map(row => <tr key={row.trx}><td><span className="table-person"><span className="table-avatar">{row.sender[0]}</span><span><strong>{row.sender}</strong><small>{row.detail}</small></span></span></td><td><strong>{row.amount}</strong><small className="table-sub">{row.time}</small></td><td><span className="trx-id">{row.trx}</span></td><td>{row.order}</td><td><span className="channel-chip">{row.channel}</span></td><td><span className={`status-badge ${row.tone}`}>{row.status}</span></td><td>{row.tone === 'unmatched' && <button className="approve-button" onClick={approvePayment}>Approve</button>}</td></tr>)}</tbody></table></div>}
      {activeTab !== 'calls' && <div className="mobile-transactions">{rows.map(row => <article className="mobile-transaction" key={row.trx}><div className="mobile-transaction-top"><span className="table-person"><span className="table-avatar">{row.sender[0]}</span><span><strong>{row.sender}</strong><small>{row.time} · {row.channel}</small></span></span><strong>{row.amount}</strong></div><div className="mobile-transaction-meta"><span>TrxID <b>{row.trx}</b></span><span className={`status-badge ${row.tone}`}>{row.status}</span></div>{row.tone === 'unmatched' && <button className="approve-button" onClick={approvePayment}>Approve payment</button>}</article>)}</div>}
    </section>
    {activeTab !== 'payments' && <div className="call-log-grid"><section className="panel call-log-panel"><div className="panel-heading"><div><span className="eyebrow">VOICE ACTIVITY</span><h2>Call history & recordings</h2></div><span className="count-pill">{callLogs.length} recent calls{callHistorySource === 'demo' ? ' · demo' : ''}</span></div>{callsError && <p className="sim-status-error" role="alert">{callsError}</p>}<div className="call-history-list">{callLogs.map(call => <CallHistoryRow key={call.id} call={call} notify={notify} />)}{!callsError && callLogs.length === 0 && <p className="call-history-empty">No call history is available yet.</p>}</div></section>{activeTab === 'all' && <aside className="panel review-card"><span className="review-icon"><ShieldCheck size={19} /></span><strong>Human review stays in control</strong><p>Unmatched payments wait for your approval before an order is updated.</p></aside>}</div>}
  </>
}

function CallHistoryRow({ call, notify }: { call: CallLog; notify: (message: string) => void }) {
  const tone = call.status === 'Completed' ? 'matched' : call.status === 'No answer' ? 'unmatched' : 'call-follow-up'
  return <article className="call-history-row">
    <div className="call-history-heading"><span className="call-history-number"><span className="call-history-icon"><AudioLines size={16} /></span><span><strong>{call.phone}</strong><small>{call.timestamp} <i>·</i> {call.duration}</small></span></span><span className={`status-badge ${tone}`}>{call.status}</span></div>
    <p className="call-ai-summary"><Sparkles size={14} /><span>{call.summary}</span></p>
    <CallAudioPlayer src={call.recordingUrl} onUnavailable={() => notify('This call does not have a recording file yet.')} />
  </article>
}

function CallAudioPlayer({ src, onUnavailable }: { src?: string | null; onUnavailable: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState('1')
  const available = Boolean(src)
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  async function togglePlayback() {
    if (!audioRef.current || !src) { onUnavailable(); return }
    if (audioRef.current.paused) {
      try { await audioRef.current.play(); setPlaying(true) }
      catch { onUnavailable() }
    } else { audioRef.current.pause(); setPlaying(false) }
  }
  function seek(value: number) {
    setCurrentTime(value)
    if (audioRef.current) audioRef.current.currentTime = value
  }
  function changeSpeed(value: string) {
    setSpeed(value)
    if (audioRef.current) audioRef.current.playbackRate = Number(value)
  }
  return <div className={`call-audio-player ${!available ? 'is-unavailable' : ''}`}>
    <audio ref={audioRef} src={src ?? undefined} preload="metadata" onLoadedMetadata={event => setDuration(event.currentTarget.duration || 0)} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
    <button className="audio-play-button" onClick={togglePlayback} aria-label={playing ? 'Pause recording' : 'Play recording'} disabled={!available}>{playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button>
    <span className="audio-time">{formatTime(currentTime)}</span>
    <input className="audio-scrubber" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={event => seek(Number(event.target.value))} aria-label="Recording playback position" disabled={!available || duration === 0} />
    <span className="audio-time">{duration ? formatTime(duration) : '--:--'}</span>
    <select className="audio-speed" value={speed} onChange={event => changeSpeed(event.target.value)} aria-label="Playback speed"><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>
    {!available && <span className="audio-unavailable-label">No recording</span>}
  </div>
}

function SettingsPage({ notify }: { notify: (message: string) => void }) {
  const [voice, setVoice] = useState('Female · Warm');
  const [courier, setCourier] = useState('Steadfast');
  const [knowledge, setKnowledge] = useState('If delivery is delayed due to rain, explain the delay clearly and share the updated estimated delivery time.');
  return <><SettingsTabs /><PageIntro eyebrow="WORKSPACE PREFERENCES" title="Settings" subtitle="Shape how KashNode speaks, responds, and works with your commerce tools." action={<button className="primary-button" onClick={() => notify('Settings saved locally for this preview.')}><Check size={16} /> Save changes</button>} /><div className="settings-grid"><section className="panel settings-card"><div className="settings-section-head"><span className="settings-section-icon"><AudioLines size={18} /></span><span><strong>AI voice profile</strong><small>Choose the voice customers hear on calls.</small></span></div><label className="field-label" htmlFor="voice-profile">Voice profile</label><select id="voice-profile" className="text-field" value={voice} onChange={event => setVoice(event.target.value)}><option>Female · Warm</option><option>Female · Clear</option><option>Male · Warm</option><option>Male · Clear</option></select><label className="field-label spaced-label" htmlFor="voice-tone">Speaking tone</label><select id="voice-tone" className="text-field"><option>Friendly and professional</option><option>Concise and direct</option><option>Warm and reassuring</option></select><div className="voice-preview"><span><AudioLines size={16} /><span><strong>Voice preview</strong><small>{voice}</small></span></span><button className="play-button" aria-label="Preview selected voice" onClick={() => notify('Voice preview requires an AI voice provider.')}><Play size={14} fill="currentColor" /></button></div></section><section className="panel settings-card"><div className="settings-section-head"><span className="settings-section-icon knowledge"><Sparkles size={18} /></span><span><strong>Knowledge base</strong><small>Give your AI helpful context about your business.</small></span></div><label className="field-label" htmlFor="knowledge">Response guidance</label><textarea id="knowledge" className="text-field knowledge-field" value={knowledge} onChange={event => setKnowledge(event.target.value)} maxLength={1200} /><div className="field-counter">{knowledge.length} / 1,200 characters</div><div className="knowledge-tip"><Sparkles size={15} /><span>Keep guidance specific, helpful, and up to date.</span></div></section><section className="panel settings-card courier-card"><div className="settings-section-head"><span className="settings-section-icon courier"><ShoppingBag size={18} /></span><span><strong>Delivery partners</strong><small>Select the courier integrations you use.</small></span></div><div className="courier-options">{['Steadfast', 'RedX'].map((name, index) => <label className={`courier-option ${courier === name ? 'chosen' : ''}`} key={name}><input type="radio" name="courier" value={name} checked={courier === name} onChange={() => setCourier(name)} /><span className={`courier-logo courier-${index}`}>{name === 'Steadfast' ? 'S' : 'R'}</span><span><strong>{name}</strong><small>{courier === name ? 'Selected' : 'Connect integration'}</small></span>{courier === name && <Check size={16} className="courier-check" />}</label>)}</div><button className="secondary-button connect-courier" onClick={() => notify(`${courier} integration setup will open here.`)}>Configure {courier} <ArrowUpRight size={14} /></button></section><aside className="panel account-note"><span className="note-icon"><ShieldCheck size={18} /></span><strong>Account security</strong><p>Your workspace is protected with secure sessions and role-based access.</p><button className="subtle-link" onClick={() => notify('Security settings are managed by your organization.')}>Review security <ArrowUpRight size={13} /></button></aside></div></>
}

function SimUssdSettings({ notify }: { notify: (message: string) => void }) {
  const [frequency, setFrequency] = useState<SimUssdSettings['frequency']>('Every 6 hours')
  const [balanceCode, setBalanceCode] = useState('*566#')
  const [internetCode, setInternetCode] = useState('*5000#')
  const [autoBalance, setAutoBalance] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getSimUssdSettings().then(settings => {
      setAutoBalance(settings.autoBalance)
      setFrequency(settings.frequency)
      setBalanceCode(settings.balanceCode)
      setInternetCode(settings.internetCode)
    }).catch(() => notify('Could not load saved SIM settings. Sign in and check the API connection.'))
      .finally(() => setLoading(false))
  }, [])
  async function saveSettings() {
    setSaving(true)
    try {
      await saveSimUssdSettings({ autoBalance, frequency, balanceCode, internetCode })
      notify('SIM and USSD settings saved.')
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not save SIM settings.') }
    finally { setSaving(false) }
  }
  return <section className="panel sim-automation-settings">
    <div className="sim-settings-heading"><div className="settings-section-head"><span className="settings-section-icon sim-settings-icon"><Smartphone size={18} /></span><span><strong>SIM & USSD Automation</strong><small>Set how KashNode Box checks the connected SIM account.</small></span></div><button className={`switch ${autoBalance ? 'on' : ''}`} role="switch" aria-checked={autoBalance} aria-label="Enable automatic SIM balance checks" onClick={() => setAutoBalance(value => !value)}><i /></button></div>
    <div className="sim-ussd-grid">
      <div><label className="field-label" htmlFor="balance-frequency">Auto-balance check frequency</label><select id="balance-frequency" className="text-field" value={frequency} onChange={event => setFrequency(event.target.value as SimUssdSettings['frequency'])} disabled={!autoBalance}><option>Every 6 hours</option><option>Daily</option><option>Manual</option></select><small className="sim-field-hint">{autoBalance ? 'Checks run while the KashNode Box is online.' : 'Automatic balance checks are paused.'}</small></div>
      <div><label className="field-label" htmlFor="ussd-balance">Balance check USSD code</label><input id="ussd-balance" className="text-field ussd-input" value={balanceCode} onChange={event => setBalanceCode(event.target.value)} inputMode="text" maxLength={32} placeholder="*566#" /><small className="sim-field-hint">Example: *566#</small></div>
      <div><label className="field-label" htmlFor="ussd-data">Internet balance USSD code</label><input id="ussd-data" className="text-field ussd-input" value={internetCode} onChange={event => setInternetCode(event.target.value)} inputMode="text" maxLength={32} placeholder="*5000#" /><small className="sim-field-hint">Example: *5000#</small></div>
    </div>
    <div className="sim-ussd-footer"><span><ShieldCheck size={15} /> {loading ? 'Loading saved preferences…' : 'USSD codes can vary by mobile operator and SIM plan.'}</span><button className="primary-button" onClick={() => void saveSettings()} disabled={loading || saving}><Check size={15} /> {saving ? 'Saving…' : 'Save SIM settings'}</button></div>
  </section>
}

export default AppShell
