import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Loader2, LogOut, Smartphone } from 'lucide-react'
import { getMerchantCredentials, getMerchantOnboarding, type AuthUser, type MerchantOnboardingProfile } from '../lib/auth'
import { getCallHistory, getCourierOrders, getMerchantOrders, getMerchantPackage, getSimStatus, syncShopifyOrders, type CallHistoryEntry, type MerchantCourierOrder, type MerchantOrder, type SimStatus } from '../lib/kashApi'
import KashNodeLogo from '../components/KashNodeLogo'
import MerchantIntegrationsSettings from '../components/MerchantIntegrationsSettings'
import MerchantTopupForm from '../components/MerchantTopupForm'
import BillingPhoneSettings from '../components/BillingPhoneSettings'
import MerchantDeviceCredentialsCard from '../components/MerchantDeviceCredentialsCard'
import Sidebar from '../components/Sidebar'

type Props = { user: AuthUser; onSignOut: () => void }
type Theme = 'dark' | 'system'

function maskDeviceId(deviceId: string) {
  if (!deviceId) return '—'
  return deviceId.length > 4 ? `KN-BOX-••••${deviceId.slice(-4)}` : deviceId
}

export default function AppShell({ user, onSignOut }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname
  const view = pathname === '/dashboard' ? 'home'
    : pathname === '/dashboard/orders' ? 'orders'
      : pathname === '/dashboard/calls' ? 'calls'
        : pathname === '/dashboard/box' ? 'box'
          : pathname === '/dashboard/wallet' ? 'wallet'
            : pathname.startsWith('/dashboard/integrations') ? 'integrations'
              : pathname.startsWith('/dashboard/settings') ? 'settings'
                : pathname === '/dashboard/alerts' ? 'alerts' : 'home'
  const settingsSection = pathname === '/dashboard/settings/billing' ? 'billing' : pathname === '/dashboard/settings/api' ? 'api' : 'profile'
  const integrationSection = pathname === '/dashboard/integrations/stores' ? 'stores' : 'couriers'
  const validDashboardPaths = ['/dashboard', '/dashboard/orders', '/dashboard/calls', '/dashboard/box', '/dashboard/wallet', '/dashboard/alerts', '/dashboard/integrations', '/dashboard/integrations/couriers', '/dashboard/integrations/stores', '/dashboard/settings', '/dashboard/settings/profile', '/dashboard/settings/billing', '/dashboard/settings/api']
  useEffect(() => {
    if (pathname === '/dashboard/integrations/webhooks') { navigate('/dashboard/integrations/stores', { replace: true }); return }
    if (!validDashboardPaths.includes(pathname)) navigate('/dashboard', { replace: true })
  }, [pathname, navigate])
  const [theme, setTheme] = useState<Theme>('dark')
  const [voice, setVoice] = useState<'Female' | 'Male'>('Female')
  const [orderFilter, setOrderFilter] = useState<'all' | 'review'>('all')
  const [orders, setOrders] = useState<MerchantOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState('')
  const [ordersSyncing, setOrdersSyncing] = useState(false)
  const [notice, setNotice] = useState('')
  const [alertBox, setAlertBox] = useState(true)
  const [alertWallet, setAlertWallet] = useState(true)
  const [alertFailed, setAlertFailed] = useState(true)
  const [simStatus, setSimStatus] = useState<SimStatus | null>(null)
  const [simError, setSimError] = useState('')
  const [simRefreshing, setSimRefreshing] = useState(false)
  const [callLogs, setCallLogs] = useState<CallHistoryEntry[]>([])
  const [callSource, setCallSource] = useState<'billing_ledger' | null>(null)
  const [callsError, setCallsError] = useState('')
  const [courierOrders, setCourierOrders] = useState<MerchantCourierOrder[]>([])
  const [courierOrdersError, setCourierOrdersError] = useState('')
  const [activePackage, setActivePackage] = useState<'free' | 'basic' | 'standard' | 'premium'>('basic')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [availableVoiceMinutes, setAvailableVoiceMinutes] = useState<number | null>(null)
  const [gatewayProfile, setGatewayProfile] = useState<MerchantOnboardingProfile | null>(null)
  const [packageRate, setPackageRate] = useState(7)
  const [packageLoading, setPackageLoading] = useState(true)
  const [merchantId, setMerchantId] = useState('')
  const [merchantSecretKey, setMerchantSecretKey] = useState('')
  const [secretLoading, setSecretLoading] = useState(true)
  const [secretError, setSecretError] = useState('')

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
      const payload = await getSimStatus()
      setSimStatus(payload.sim)
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
    getMerchantOrders().then(payload => { if (alive) setOrders(payload.orders || []) }).catch(error => { if (alive) setOrdersError(error instanceof Error ? error.message : 'Could not load orders.') }).finally(() => { if (alive) setOrdersLoading(false) })
    getMerchantOnboarding().then(profile => { if (alive) setGatewayProfile(profile) }).catch(() => {})
    getMerchantCredentials()
      .then(credentials => { if (alive) { setMerchantId(credentials.merchantId); setMerchantSecretKey(credentials.merchantSecretKey) } })
      .catch(error => { if (alive) setSecretError(error instanceof Error ? error.message : 'Could not load merchant pairing credentials.') })
      .finally(() => { if (alive) setSecretLoading(false) })
    getCourierOrders()
      .then(payload => { if (alive) setCourierOrders(payload.courierOrders || []) })
      .catch(error => { if (alive) setCourierOrdersError(error instanceof Error ? error.message : 'Could not load courier bookings.') })
    getCallHistory()
      .then((payload) => {
        if (!alive) return
        setCallSource(payload.source)
        setCallLogs(payload.calls)
      })
      .catch((error) => {
        if (alive) setCallsError(error instanceof Error ? error.message : 'Could not load call history.')
      })
    getMerchantPackage()
      .then(async (payload) => {
        if (!alive) return
        setActivePackage(payload.package)
        setPackageRate(Number.isFinite(Number(payload.ratePerMinute)) ? Number(payload.ratePerMinute) : 7)
        setWalletBalance(Number(payload.walletBalance || 0))
        setAvailableVoiceMinutes(Number(payload.availableVoiceMinutes || 0))
      })
      .catch(() => {
        if (alive) setActivePackage('basic')
      })
      .finally(() => {
        if (alive) {
          setPackageLoading(false)
        }
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  const visibleOrders = orderFilter === 'review' ? orders.filter(order => ['unpaid', 'manual_review', 'pending'].includes(String(order.payment_status).toLowerCase())) : orders

  async function handleShopifySync() {
    setOrdersSyncing(true)
    setOrdersError('')
    try {
      const result = await syncShopifyOrders()
      setOrders(result.orders || [])
      notify(`Shopify sync complete: ${result.synced} new, ${result.updated} updated orders.`)
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'Could not sync Shopify orders.')
    } finally {
      setOrdersSyncing(false)
    }
  }
  const signal = simStatus ? Math.max(0, Math.min(5, Math.round(simStatus.signalStrength))) : 0


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
            <button className="md-bell" aria-label="Alerts and settings" onClick={() => navigate('/dashboard/alerts')}><Bell size={18} /><i /></button>
            <button className="md-signout" onClick={onSignOut} aria-label="Sign out"><LogOut size={16} /> Sign out</button>
          </div>
        </header>

        <Sidebar variant="desktop" />

        <div className="md-banner" role="note">
          Live SIM telemetry, wallet balance, voice sessions and orders are loaded from your merchant account.
        </div>

        <main className="md-main">
          {view === 'home' && (
            <section>
              <p className="md-eyebrow">GOOD MORNING, {firstName.toUpperCase()}</p>
              <h1 className="md-title">Is everything working?</h1>
              <p className="md-muted">{packageLoading ? 'Loading package…' : activePackage === 'free' ? `Free Trial · ${availableVoiceMinutes ?? 0} mins remaining (10 mins included)` : `${activePackage[0].toUpperCase()}${activePackage.slice(1)} package · ৳${(Number.isFinite(packageRate) ? packageRate : 7).toFixed(2)}/minute`}</p>
              {activePackage === 'free' && <p className="md-muted">৳{packageRate.toFixed(2)}/minute applies only after your included free minutes are used. No per-minute charge while included minutes remain.</p>}
              <p className="md-sub">Live status for Kash AI, your KashNode Box and your store, in one place.</p>
              <div className="md-status-list">
                <div className="md-status-row"><span><i className="md-dot ok" /> Kash AI</span><strong>Live</strong></div>
                <div className="md-status-row"><span><i className="md-dot ok" /> KashNode Box</span><strong>{simStatus ? (simStatus.online ? 'Online' : 'Offline') : 'Not linked'}</strong></div>
                <div className="md-status-row"><span><i className="md-dot ok" /> Store plugin</span><strong>Connected</strong></div>
              </div>
              <div className="md-stats">
                <div><strong>{walletBalance == null ? '—' : `৳${walletBalance.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong><span>Wallet Balance</span></div>
                <div><strong>{availableVoiceMinutes == null ? '—' : `${availableVoiceMinutes} min`}</strong><span>{activePackage === 'free' ? 'Free Minutes Remaining' : 'Voice Minutes Available'}</span></div>
              </div>
              <p className="md-muted">Last sync: {simStatus ? new Date(simStatus.updatedAt).toLocaleString() : 'No merchant device has reported yet'}</p>
              <button className="md-primary" onClick={() => navigate('/dashboard/orders')}>Check today’s orders</button>

              <article className="md-card md-app-download-card">
                <div className="md-card-top"><strong><Smartphone size={18}/> Download Kash AI App</strong><span className="md-badge">Android</span></div>
                <p className="md-muted">Install the Android app and pair it using your Merchant ID and secret above.</p>
                <a className="md-primary md-gateway-link" href="/downloads/kash-ai-android.apk" download><Smartphone size={17}/> Download Kash AI APK</a>
                <small className="md-muted">Placeholder release URL; publish the signed APK at this path before announcing downloads.</small>
              </article>
            </section>
          )}

          {view === 'orders' && (
            <section>
              <div className="md-card-top">
                <div><h1 className="md-title">Orders &amp; verification</h1><p className="md-sub">Live orders synced from your connected Shopify store.</p></div>
                <button className="md-primary" onClick={() => void handleShopifySync()} disabled={ordersSyncing}>
                  {ordersSyncing ? <Loader2 className="md-spin" size={16} /> : null} {ordersSyncing ? 'Syncing…' : 'Sync Orders'}
                </button>
              </div>
              {ordersError && <p className="md-error" role="alert">{ordersError}</p>}
              <div className="md-filters">
                <button className={orderFilter === 'all' ? 'active' : ''} onClick={() => setOrderFilter('all')}>All orders</button>
                <button className={orderFilter === 'review' ? 'active' : ''} onClick={() => setOrderFilter('review')}>Needs review</button>
              </div>
              <div className="md-list">
                {ordersLoading ? <article className="md-card"><p className="md-muted">Loading your orders…</p></article>
                  : visibleOrders.length === 0 ? <article className="md-card"><p className="md-muted">{orderFilter === 'review' ? 'No orders need review.' : 'No orders found yet. Connect Shopify and select Sync Orders to import recent orders.'}</p></article>
                  : visibleOrders.map(order => {
                    const status = String(order.payment_status || 'unpaid')
                    const tone = status === 'paid' ? 'ok' : status === 'manual_review' ? 'warn' : ''
                    const lineSummary = (order.line_items || []).slice(0, 3).map(item => `${item.title || 'Item'} × ${item.quantity || 1}`).join(', ')
                    return <article className="md-card" key={order.id}>
                      <div className="md-card-top"><strong>{order.order_number || `#${order.platform_order_id}`}</strong><span className={`md-badge ${tone}`}>{status.replace('_', ' ')}</span></div>
                      <p>{order.customer_name || 'Shopify customer'} · {order.customer_phone || 'No phone provided'}</p>
                      <p>{order.payment_method || 'Payment method unavailable'} · {order.currency || 'BDT'} {Number(order.total_amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      {lineSummary && <p className="md-muted">{lineSummary}</p>}
                      {order.shipping_address && <p className="md-muted">{order.shipping_address}</p>}
                      <p className="md-muted">Fulfillment: {order.fulfillment_status || order.delivery_status || 'unfulfilled'} · {new Date(order.created_at).toLocaleString()}</p>
                    </article>
                  })}
              </div>
              {activePackage === 'basic' ? (
                <div className="md-card">
                  <strong>Courier Auto-Booking · Standard</strong>
                  <p className="md-muted">Automatic courier booking is locked on Basic.</p>
                  <button className="md-primary" onClick={() => notify('Upgrade to Standard to unlock Courier Auto-Booking.')}>Upgrade to Standard</button>
                </div>
              ) : (
                <div className="md-card">
                  <div className="md-card-top"><strong>Courier bookings</strong><span className="md-badge">{courierOrders.length} records</span></div>
                  {courierOrdersError && <p className="md-error" role="alert">{courierOrdersError}</p>}
                  {courierOrders.length === 0 ? <p className="md-muted">No courier bookings yet. A verified or paid order will appear here after automatic booking.</p> : (
                    <div className="md-list">
                      {courierOrders.map(item => (
                        <article className="md-card" key={item.orderId + item.trackingCode}>
                          <div className="md-card-top"><strong>Order #{item.orderId}</strong><span className="md-badge ok">{item.status}</span></div>
                          <p>{item.courier}</p>
                          <p className="md-muted">Tracking / Consignment ID: <code>{item.trackingCode || 'Pending'}</code></p>
                          <p className="md-muted">{new Date(item.createdAt).toLocaleString()}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {view === 'calls' && (
            <section>
              <h1 className="md-title">Kash AI calls</h1>
              <p className="md-sub">What Kash said to your customers, and what needs a follow-up.</p>
              <div className="md-stats">
                <div><strong>{callLogs.length}</strong><span>Completed calls</span></div>
                <div><strong>{(callLogs.reduce((total, call) => total + call.durationSeconds, 0) / 60).toFixed(1)} min</strong><span>Billed voice time</span></div>
              </div>
              {callsError && <p className="md-error" role="alert">{callsError}</p>}
              <p className="md-muted">Call history source: {callSource === 'billing_ledger' ? 'Billing ledger' : 'loading…'}</p>
              <div className="md-list">
                {callLogs.length === 0 ? (
                  <article className="md-card"><p className="md-muted">No completed AI voice sessions have been billed to this workspace yet.</p></article>
                ) : callLogs.map((call) => (
                  <article className="md-card" key={call.id}>
                    <div className="md-card-top"><strong>{call.phone}</strong><span className="md-badge ok">{call.status}</span></div>
                    <p>{new Date(call.occurredAt).toLocaleString()} · {Math.floor(call.durationSeconds / 60)}:{String(Math.floor(call.durationSeconds % 60)).padStart(2, '0')}</p>
                    <p className="md-muted">{call.summary}</p>
                    <p className="md-muted">Billed: {call.currency === 'BDT' ? '৳' : call.currency + ' '}{call.billedAmount.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {call.billingSource.replace('_', ' ')}</p>
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

          {view === 'integrations' && (
            <section>
              <MerchantIntegrationsSettings section={integrationSection} onNotify={notify} />
            </section>
          )}

          {view === 'box' && (
            <section>
              <h1 className="md-title">KashNode Box</h1>
              <p className="md-sub">The device at your home or office, with your business SIM inside it.</p>
              {simError && <p className="md-error" role="alert">{simError}</p>}
              <div className="md-card">
                <div className="md-card-top"><strong>Device</strong><span className={`md-badge ${simStatus?.online ? 'ok' : 'bad'}`}>{simStatus ? (simStatus.online ? 'Online' : 'Offline') : 'Not linked'}</span></div>
                <p>Device ID: {simStatus ? maskDeviceId(simStatus.deviceId) : '—'}</p>
                <p>SIM balance: {simStatus ? `৳${simStatus.balance.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</p>
                <p>Signal: {signal >= 4 ? 'Strong' : signal >= 2 ? 'Moderate' : signal > 0 ? 'Weak' : 'No signal data'} ({signal}/5)</p>
                <p>Network: {simStatus?.networkType || '—'}</p>
                <p>Data remaining: {simStatus ? `${Math.round(simStatus.internetDataMb)} MB of ${Math.round(simStatus.dataQuotaMb)} MB` : '—'}</p>
                <p className="md-muted">Last sync: {simStatus ? new Date(simStatus.updatedAt).toLocaleString() : 'Waiting for device pairing'}</p>
                <button className="md-secondary" onClick={() => void refreshSim()} disabled={simRefreshing}>{simRefreshing ? 'Refreshing…' : 'Refresh SIM status'}</button>
              </div>

              <div className="md-card">
                <strong>Store connections</strong>
                <p className="md-muted">Manage Shopify and WooCommerce credentials in one place.</p>
                <button className="md-secondary" onClick={() => navigate('/dashboard/integrations/stores')}>Manage integrations</button>
              </div>
            </section>
          )}

          {view === 'wallet' && (
            <section>
              <h1 className="md-title">Wallet &amp; usage</h1>
              <p className="md-sub">Your live wallet and included voice minutes are read from your merchant account.</p>
              <div className="md-card">
                <div className="md-card-top"><strong>Wallet Balance</strong><span className="md-badge">Live from Supabase</span></div>
                <h2>{walletBalance == null ? 'Loading…' : `৳${walletBalance.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</h2>
                <p className="md-muted">Available wallet funds for AI voice processing.</p>
                <p className="md-muted">Top-ups are credited only after an incoming payment notification is matched to your verified billing phone.</p>
              </div>
              <div className="md-card">
                <div className="md-card-top"><strong>{activePackage === 'free' ? 'Free Trial Minutes Remaining' : 'Available Voice Minutes'}</strong><span className="md-badge">Live from Supabase</span></div>
                <h2>{availableVoiceMinutes == null ? 'Loading…' : `${availableVoiceMinutes} min`}</h2>
                <p className="md-muted">{activePackage === 'free' ? `Your first 10 AI voice minutes are included. ৳${packageRate.toFixed(2)}/minute is charged only after those free minutes expire.` : `Your current overage rate is ৳${packageRate.toFixed(2)}/minute after available minutes are used.`}</p>
              </div>
              <MerchantTopupForm billingPhone={gatewayProfile?.billingPhone || ''} billingPhoneVerified={Boolean(gatewayProfile?.isBillingPhoneVerified)} />
            </section>
          )}

          {view === 'settings' && (
            <section>
              {settingsSection === 'profile' && (
                <>
                  <div className="md-card md-gateway-profile">
                    <div className="md-card-top">
                      <div><strong>Workspace profile</strong><p className="md-muted">Your selected connection method and workspace package.</p></div>
                      <span className="md-badge ok">{gatewayProfile?.gatewayPreference === 'box' ? 'KashNode Box' : 'Kash AI App'}</span>
                    </div>
                    <p>Package: {(gatewayProfile?.selectedPlan || activePackage).toString().toUpperCase()}</p>
                    {gatewayProfile?.gatewayPreference === 'box' ? (
                      <>
                        <p>Hardware price: <strong>৳8,000 one-time</strong></p>
                        <p>Hardware fulfillment: <strong>{(gatewayProfile.boxFulfillmentStatus || 'not_requested').replaceAll('_', ' ')}</strong></p>
                        <p className="md-muted">Your Box pre-order status will appear here. SIM details can be added during setup or when the device is ready.</p>
                        <div className="md-profile-action"><a className="md-secondary md-gateway-link" href="/hardware">View KashNode Box details</a></div>
                      </>
                    ) : (
                      <>
                        <p className="md-muted">You are using the free Android gateway. No dedicated hardware or Box SIM is required to get started.</p>
                        <a className="md-primary md-gateway-link" href="/downloads/kash-ai-android.apk" download><Smartphone size={17} /> Download Kash AI Android App</a>
                        <small className="md-muted">The production APK will be published here when the signed release is available.</small>
                      </>
                    )}
                  </div>
    
                </>
              )}
              {settingsSection === 'billing' && (
                <>
                  <h1 className="md-title">Billing &amp; MFS verification</h1>
                  <p className="md-sub">Verify the phone number used to identify your incoming wallet top-ups.</p>
                  <BillingPhoneSettings phone={gatewayProfile?.billingPhone || ''} verified={Boolean(gatewayProfile?.isBillingPhoneVerified)} />
                </>
              )}
              {settingsSection === 'api' && (
                <>
                  <h1 className="md-title">Security &amp; API keys</h1>
                  <p className="md-sub">Manage your merchant device credentials and connected webhook/API integrations.</p>
                  <MerchantDeviceCredentialsCard merchantId={merchantId} secret={merchantSecretKey} loading={secretLoading} error={secretError} onNotify={notify} />
                  <div className="md-card">
                    <strong>Integration configuration</strong>
                    <p className="md-muted">Store and courier credentials, connection tests, and webhook setup are managed from the Integrations page.</p>
                    <button className="md-secondary" type="button" onClick={() => navigate('/dashboard/integrations/stores')}>Open E-Commerce Stores</button>
                  </div>
                </>
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
              <button className="md-secondary" onClick={() => navigate('/dashboard')}>Back to Home</button>
            </section>
          )}
        </main>

        <Outlet />
        <Sidebar variant="mobile" />

        {notice && <div className="md-toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
      </div>
    </div>
  )
}
