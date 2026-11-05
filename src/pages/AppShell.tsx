import { useEffect, useState } from 'react'
import { Bell, Box, Home, LogOut, PhoneCall, ShoppingBag, Wallet } from 'lucide-react'
import type { AuthUser } from '../lib/auth'
import { getCallHistory, getSimStatus, type CallHistoryEntry, type SimStatus } from '../lib/kashApi'
import KashNodeLogo from '../components/KashNodeLogo'

type Props = { user: AuthUser; onSignOut: () => void }
type View = 'home' | 'orders' | 'calls' | 'box' | 'wallet' | 'alerts'
type Theme = 'dark' | 'system'

type SampleOrder = { id: string; channel: string; amount: string; status: string; tone: string; trx: string; note: string }
type SampleCall = { id: string; phone: string; time: string; duration: string; status: string; summary: string }

const sampleOrders: SampleOrder[] = [
  { id: '#KN-48219', channel: 'bKash', amount: '৳ 1,250', status: 'COD SMS verified', tone: 'ok', trx: 'B8K2••••', note: 'Order confirmed' },
  { id: '#KN-48218', channel: 'Nagad', amount: '৳ 890', status: 'Needs review', tone: 'warn', trx: '9FK2••••', note: 'TrxID unmatched' },
  { id: '#KN-48217', channel: 'Rocket', amount: '৳ 2,450', status: 'TrxID matched', tone: 'ok', trx: 'A4P7••••', note: 'Payment verified' },
  { id: '#KN-48216', channel: 'Upay', amount: '৳ 3,600', status: 'Fake blocked', tone: 'bad', trx: 'C6L1••••', note: 'COD verification failed' },
]

const sampleCalls: SampleCall[] = [
  { id: '1', phone: '+880 17•• ••• 8291', time: 'Today, 10:42 AM', duration: '2:18', status: 'Completed', summary: 'Order confirmed and delivery time explained.' },
  { id: '2', phone: '+880 18•• ••• 4221', time: 'Today, 09:56 AM', duration: '0:00', status: 'Failed', summary: 'Customer did not answer. Follow-up needed.' },
]

function maskDeviceId(deviceId: string) {
  if (!deviceId) return '—'
  return deviceId.length > 4 ? `KN-BOX-••••${deviceId.slice(-4)}` : deviceId
}

export default function AppShell({ user, onSignOut }: Props) {
  const [view, setView] = useState<View>('home')
  const [theme, setTheme] = useState<Theme>('dark')
  const [voice, setVoice] = useState<'Female' | 'Male'>('Female')
  const [orderFilter, setOrderFilter] = useState<'all' | 'review'>('all')
  const [rechargeOpen, setRechargeOpen] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState(500)
  const [notice, setNotice] = useState('')
  const [alertBox, setAlertBox] = useState(true)
  const [alertWallet, setAlertWallet] = useState(true)
  const [alertFailed, setAlertFailed] = useState(true)
  const [simStatus, setSimStatus] = useState<SimStatus | null>(null)
  const [simError, setSimError] = useState('')
  const [simRefreshing, setSimRefreshing] = useState(false)
  const [callLogs, setCallLogs] = useState<CallHistoryEntry[]>([])
  const [callSource, setCallSource] = useState<'demo' | 'database' | null>(null)
  const [callsError, setCallsError] = useState('')

  const firstName = user.name?.split(' ')[0] || user.email.split('@')[0]
  const systemIsLight = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
  const resolvedTheme = theme === 'system' && systemIsLight ? 'light' : 'dark'

  function notify(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  async function refreshSim(quiet = false) {
    setSimRefreshing(true)
    setSimError('')
    try {
      setSimStatus(await getSimStatus())
      if (!quiet) notify('SIM status refreshed.')
    } catch (error) {
      setSimError(error instanceof Error ? error.message : 'Could not load SIM status.')
    } finally {
      setSimRefreshing(false)
    }
  }

  useEffect(() => {
    let alive = true
    void refreshSim(true)
    getCallHistory()
      .then((payload) => {
        if (!alive) return
        setCallSource(payload.source)
        setCallLogs(payload.calls)
      })
      .catch((error) => {
        if (alive) setCallsError(error instanceof Error ? error.message : 'Could not load call history.')
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleOrders = orderFilter === 'review' ? sampleOrders.filter((order) => order.tone === 'warn') : sampleOrders
  const signal = simStatus ? Math.max(0, Math.min(5, Math.round(simStatus.signalStrength))) : 0
  const nav: { key: View; label: string; icon: typeof Home }[] = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'orders', label: 'Orders', icon: ShoppingBag },
    { key: 'calls', label: 'Calls', icon: PhoneCall },
    { key: 'box', label: 'Box', icon: Box },
    { key: 'wallet', label: 'Wallet', icon: Wallet },
  ]

  return (
    <div className={`md-app md-${resolvedTheme}`}>
      <div className="md-frame">
        <header className="md-header">
          <span className="md-brand"><KashNodeLogo /></span>
          <div className="md-header-actions">
            <div className="md-theme" role="group" aria-label="Theme">
              <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button>
              <button className={theme === 'system' ? 'active' : ''} onClick={() => setTheme('system')}>System</button>
            </div>
            <button className="md-bell" aria-label="Alerts and settings" onClick={() => setView('alerts')}><Bell size={18} /><i /></button>
            <button className="md-signout" onClick={onSignOut} aria-label="Sign out"><LogOut size={16} /> Sign out</button>
          </div>
        </header>

        <nav className="md-desktop-nav" aria-label="Merchant navigation for desktop">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}>
                <Icon size={18} /><span>{item.label}</span>
              </button>
            )
          })}
          <button className={view === 'alerts' ? 'active' : ''} onClick={() => setView('alerts')}>
            <Bell size={18} /><span>Alerts</span>
          </button>
        </nav>

        <div className="md-banner" role="note">
          Layout preview — sample operations, wallet balance and AI voice usage. SIM and call history load from your account when available.
        </div>

        <main className="md-main">
          {view === 'home' && (
            <section>
              <p className="md-eyebrow">GOOD MORNING, {firstName.toUpperCase()}</p>
              <h1 className="md-title">Is everything working?</h1>
              <p className="md-sub">Live status for Kash AI, your KashNode Box and your store, in one place.</p>
              <div className="md-status-list">
                <div className="md-status-row"><span><i className="md-dot ok" /> Kash AI</span><strong>Live</strong></div>
                <div className="md-status-row"><span><i className="md-dot ok" /> KashNode Box</span><strong>{simStatus ? (simStatus.online ? 'Online' : 'Offline') : 'Checking…'}</strong></div>
                <div className="md-status-row"><span><i className="md-dot ok" /> Store plugin</span><strong>Connected</strong></div>
              </div>
              <div className="md-stats">
                <div><strong>৳4,250</strong><span>Wallet Balance</span></div>
                <div><strong>86 min</strong><span>AI Minutes Used</span></div>
              </div>
              <p className="md-muted">Last sync: {simStatus ? new Date(simStatus.updatedAt).toLocaleString() : 'Waiting for device data'}</p>
              <button className="md-primary" onClick={() => setView('orders')}>Check today’s orders</button>
            </section>
          )}

          {view === 'orders' && (
            <section>
              <h1 className="md-title">Orders &amp; verification</h1>
              <p className="md-sub">COD SMS, fake-order blocking and MFS TrxID matching for your store.</p>
              <div className="md-filters">
                <button className={orderFilter === 'all' ? 'active' : ''} onClick={() => setOrderFilter('all')}>All orders</button>
                <button className={orderFilter === 'review' ? 'active' : ''} onClick={() => setOrderFilter('review')}>Needs review</button>
              </div>
              <div className="md-list">
                {visibleOrders.map((order) => (
                  <article className="md-card" key={order.id}>
                    <div className="md-card-top"><strong>{order.id}</strong><span className={`md-badge ${order.tone}`}>{order.status}</span></div>
                    <p>{order.channel} · {order.amount}</p>
                    <p className="md-muted">TrxID {order.trx} · {order.note}</p>
                  </article>
                ))}
              </div>
              <div className="md-card">
                <strong>Courier</strong>
                <p>Steadfast: 12 booked · 8 delivered</p>
                <p>Pathao: 5 booked · 3 delivered</p>
                <p className="md-warn">PIN mismatch on 1 parcel — check the courier order before delivery.</p>
              </div>
            </section>
          )}

          {view === 'calls' && (
            <section>
              <h1 className="md-title">Kash AI calls</h1>
              <p className="md-sub">What Kash said to your customers, and what needs a follow-up.</p>
              <div className="md-stats">
                <div><strong>{callLogs.length || sampleCalls.length}</strong><span>Calls shown</span></div>
                <div><strong>1</strong><span>Failed call</span></div>
              </div>
              {callsError && <p className="md-error" role="alert">{callsError}</p>}
              <p className="md-muted">Call history source: {callSource || 'loading…'}</p>
              <div className="md-list">
                {(callLogs.length > 0
                  ? callLogs.map((call) => ({ id: call.id, phone: call.phone, time: new Date(call.occurredAt).toLocaleString(), duration: `${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, '0')}`, status: call.status, summary: call.summary }))
                  : sampleCalls
                ).map((call) => (
                  <article className="md-card" key={call.id}>
                    <div className="md-card-top"><strong>{call.phone}</strong><span className={`md-badge ${call.status === 'Completed' ? 'ok' : 'bad'}`}>{call.status}</span></div>
                    <p>{call.time} · {call.duration}</p>
                    <p className="md-muted">{call.summary}</p>
                  </article>
                ))}
              </div>
              <div className="md-card">
                <strong>Kash voice</strong>
                <p className="md-muted">Choose the voice customers hear on calls.</p>
                <div className="md-filters">
                  <button className={voice === 'Female' ? 'active' : ''} onClick={() => { setVoice('Female'); notify('Kash voice set to Female in this view.') }}>Female</button>
                  <button className={voice === 'Male' ? 'active' : ''} onClick={() => { setVoice('Male'); notify('Kash voice set to Male in this view.') }}>Male</button>
                </div>
              </div>
            </section>
          )}

          {view === 'box' && (
            <section>
              <h1 className="md-title">KashNode Box</h1>
              <p className="md-sub">The device at your home or office, with your business SIM inside it.</p>
              {simError && <p className="md-error" role="alert">{simError}</p>}
              <div className="md-card">
                <div className="md-card-top"><strong>Device</strong><span className={`md-badge ${simStatus?.online ? 'ok' : 'bad'}`}>{simStatus ? (simStatus.online ? 'Online' : 'Offline') : 'Checking…'}</span></div>
                <p>Device ID: {simStatus ? maskDeviceId(simStatus.deviceId) : '—'}</p>
                <p>SIM balance: {simStatus ? `৳${simStatus.balance.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</p>
                <p>Signal: {signal >= 4 ? 'Strong' : signal >= 2 ? 'Moderate' : signal > 0 ? 'Weak' : 'No signal data'} ({signal}/5)</p>
                <p>Network: {simStatus?.networkType || '—'}</p>
                <p>Data remaining: {simStatus ? `${Math.round(simStatus.internetDataMb)} MB of ${Math.round(simStatus.dataQuotaMb)} MB` : '—'}</p>
                <p className="md-muted">Last sync: {simStatus ? new Date(simStatus.updatedAt).toLocaleString() : 'Waiting for device data'}{simStatus?.source === 'demo' ? ' · Demo data' : ''}</p>
                <button className="md-secondary" onClick={() => void refreshSim()} disabled={simRefreshing}>{simRefreshing ? 'Refreshing…' : 'Refresh SIM status'}</button>
              </div>
              <div className="md-card">
                <strong>Store connection</strong>
                <p>WooCommerce: Connected</p>
                <p>Shopify: Not connected</p>
                <p>Custom store: Not connected</p>
              </div>
            </section>
          )}

          {view === 'wallet' && (
            <section>
              <h1 className="md-title">Wallet &amp; usage</h1>
              <p className="md-sub">Pay as you go: AI voice calls are billed by call duration against your wallet.</p>
              <div className="md-card">
                <div className="md-card-top"><strong>Wallet Balance</strong><span className="md-badge">Sample preview</span></div>
                <h2>৳4,250.00</h2>
                <p className="md-muted">Available wallet funds for AI voice processing.</p>
                <button className="md-primary" onClick={() => setRechargeOpen(true)}>Add funds to wallet</button>
              </div>
              <div className="md-card">
                <div className="md-card-top"><strong>AI Minutes Used</strong><span className="md-badge">Sample preview</span></div>
                <h2>236 min</h2>
                <p className="md-muted">Voice usage billed at the sample rate of ৳7 per minute.</p>
              </div>
              {rechargeOpen && (
                <div className="md-card">
                  <strong>Choose wallet top-up amount</strong>
                  <div className="md-filters">
                    {[500, 1000, 2000].map((amount) => (
                      <button key={amount} className={rechargeAmount === amount ? 'active' : ''} onClick={() => setRechargeAmount(amount)}>৳{amount.toLocaleString('en-BD')}</button>
                    ))}
                  </div>
                  <button className="md-primary" onClick={() => { setRechargeOpen(false); notify('Wallet top-up checkout is not configured yet.') }}>Confirm ৳{rechargeAmount.toLocaleString('en-BD')} top-up</button>
                  <button className="md-secondary" onClick={() => setRechargeOpen(false)}>Cancel</button>
                </div>
              )}
            </section>
          )}

          {view === 'alerts' && (
            <section>
              <h1 className="md-title">Alerts &amp; settings</h1>
              <p className="md-sub">Get notified before a small problem becomes a lost order.</p>
              <div className="md-card">
                <div className="md-toggle-row"><span>Box goes offline</span><button className={`md-switch ${alertBox ? 'on' : ''}`} role="switch" aria-checked={alertBox} onClick={() => setAlertBox((value) => !value)}><i /></button></div>
                <div className="md-toggle-row"><span>Wallet balance runs low</span><button className={`md-switch ${alertWallet ? 'on' : ''}`} role="switch" aria-checked={alertWallet} onClick={() => setAlertWallet((value) => !value)}><i /></button></div>
                <div className="md-toggle-row"><span>Failed call or verification</span><button className={`md-switch ${alertFailed ? 'on' : ''}`} role="switch" aria-checked={alertFailed} onClick={() => setAlertFailed((value) => !value)}><i /></button></div>
              </div>
              <div className="md-card">
                <strong>Recent alerts</strong>
                <p className="md-warn">1 failed call needs a follow-up.</p>
                <p className="md-warn">1 courier parcel has a PIN mismatch.</p>
                <p className="md-muted">Signed in as {user.email}</p>
              </div>
              <button className="md-secondary" onClick={() => setView('home')}>Back to Home</button>
            </section>
          )}
        </main>

        <nav className="md-nav" aria-label="Merchant navigation">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}>
                <Icon size={20} /><span>{item.label}</span><i className="md-nav-dot" />
              </button>
            )
          })}
        </nav>

        {notice && <div className="md-toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
      </div>
    </div>
  )
}
