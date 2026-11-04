import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight,
  Box,
  ChevronLeft,
  CircleDollarSign,
  Cpu,
  LayoutDashboard,
  LogOut,
  Package,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Signal,
  Store,
  Users,
  Wifi,
} from 'lucide-react'
import KashNodeLogo from '../components/KashNodeLogo'
import type { AuthUser } from '../lib/auth'

type Props = { user: AuthUser; onSignOut: () => void }
type Section = 'overview' | 'merchants' | 'licensing' | 'hardware'
type PackageId = 'free' | 'basic' | 'standard' | 'premium'
type MerchantStatus = 'active' | 'trial' | 'suspended'

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
  latencyMs: number
  smsToday: number
}

const INITIAL_BOXES: HardwareBox[] = [
  { unit: 'KN-BOX-01', merchant: 'Dhaka Fashion Hub', online: true, signal: 5, sim: 'Business SIM · GP', latencyMs: 38, smsToday: 112 },
  { unit: 'KN-BOX-02', merchant: 'Chittagong Electronics', online: true, signal: 4, sim: 'Business SIM · Robi', latencyMs: 52, smsToday: 86 },
  { unit: 'KN-BOX-03', merchant: 'Sylhet Grocery Mart', online: true, signal: 5, sim: 'Business SIM · GP', latencyMs: 41, smsToday: 44 },
  { unit: 'KN-BOX-04', merchant: 'Khulna Beauty Store', online: false, signal: 0, sim: 'Business SIM · GP', latencyMs: 0, smsToday: 0 },
  { unit: 'KN-BOX-05', merchant: 'Rajshahi Mobile Zone', online: true, signal: 4, sim: 'Business SIM · Robi', latencyMs: 63, smsToday: 57 },
  { unit: 'KN-BOX-06', merchant: 'Rangpur Fashion Point', online: true, signal: 5, sim: 'Business SIM · GP', latencyMs: 35, smsToday: 93 },
]

const SECTIONS: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'merchants', label: 'Merchants', icon: Store },
  { id: 'licensing', label: 'Licensing & Packages', icon: Package },
  { id: 'hardware', label: 'Hardware Boxes', icon: Box },
]

function TiltCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [transform, setTransform] = useState('perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)')
  return (
    <motion.div
      className={`sa-tilt ${className}`}
      style={{ transform }}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = (event.clientX - rect.left) / rect.width - 0.5
        const y = (event.clientY - rect.top) / rect.height - 0.5
        setTransform(`perspective(900px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg) translateY(-4px)`)
      }}
      onMouseLeave={() => setTransform('perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)')}
    >
      {children}
    </motion.div>
  )
}

export default function AdminPanel({ user, onSignOut }: Props) {
  const [section, setSection] = useState<Section>('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [merchants, setMerchants] = useState<Merchant[]>(INITIAL_MERCHANTS)
  const [boxes] = useState<HardwareBox[]>(INITIAL_BOXES)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | MerchantStatus>('all')
  const [notice, setNotice] = useState('')

  const activeMerchants = merchants.filter((item) => item.status === 'active')
  const totalRevenue = activeMerchants.reduce((sum, item) => sum + packageById(item.packageId).price, 0)
  const connectedBoxes = boxes.filter((item) => item.online).length
  const isAdmin = user.role === 'admin'

  const filteredMerchants = useMemo(() => {
    const query = search.trim().toLowerCase()
    return merchants.filter((item) => {
      const matchesQuery = !query || item.name.toLowerCase().includes(query) || item.email.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [merchants, search, statusFilter])

  const sectionTitle = SECTIONS.find((item) => item.id === section)?.label ?? 'Overview'

  const changePackage = (id: string, packageId: PackageId) => {
    setMerchants((current) => current.map((item) => (item.id === id ? { ...item, packageId } : item)))
    const merchant = merchants.find((item) => item.id === id)
    setNotice(
      `Demo only: ${merchant?.name ?? 'Merchant'} moved to ${packageById(packageId).name} in this view. No real merchant was changed — that needs a super-admin API.`,
    )
  }

  const toggleSuspend = (merchant: Merchant) => {
    const nextStatus: MerchantStatus = merchant.status === 'suspended' ? 'active' : 'suspended'
    setMerchants((current) => current.map((item) => (item.id === merchant.id ? { ...item, status: nextStatus } : item)))
    setNotice(
      `Demo only: ${merchant.name} is now ${nextStatus} in this view. No real merchant was changed — that needs a super-admin API.`,
    )
  }

  return (
    <div className="sa-page">
      <motion.aside
        className={`sa-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
        initial={{ x: -24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        aria-label="Super admin navigation"
      >
        <div className="sa-sidebar-brand">
          <KashNodeLogo />
          <span className="sa-admin-badge">SUPER ADMIN</span>
          <button type="button" className="sa-collapse" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setSidebarCollapsed((value) => !value)}>
            <ChevronLeft size={16} className={sidebarCollapsed ? 'flipped' : ''} />
          </button>
        </div>
        <nav className="sa-nav">
          {SECTIONS.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} type="button" className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)} aria-current={section === item.id ? 'page' : undefined}>
                <Icon size={19} />
                <span>{item.label}</span>
                {section === item.id && <motion.i layoutId="sa-nav-glow" className="sa-nav-glow" />}
              </button>
            )
          })}
        </nav>
        <div className="sa-sidebar-user">
          <span className="sa-avatar">{(user.name?.[0] || user.email[0] || 'A').toUpperCase()}</span>
          <span className="sa-user-lines">
            <strong>{user.name || user.email}</strong>
            <small>{user.email}</small>
            <small>Role: {user.role || 'user'}</small>
          </span>
        </div>
        <button type="button" className="sa-signout" onClick={onSignOut}>
          <LogOut size={16} /> <span>Sign out</span>
        </button>
      </motion.aside>

      <div className="sa-main">
        <header className="sa-topbar">
          <div>
            <p className="sa-eyebrow">KashNode · Super Admin Panel</p>
            <h1>{sectionTitle}</h1>
          </div>
          <div className="sa-top-actions">
            <a className="sa-top-link" href="/dashboard">
              View merchant dashboard <ArrowUpRight size={15} />
            </a>
            <span className="sa-live"><i /> Live preview</span>
          </div>
        </header>

        <div className="sa-demo-banner" role="note">
          <ShieldCheck size={18} />
          <span>
            <strong>Demo data.</strong> Merchants, packages and boxes below are sample data for the frontend panel. Package and suspend actions update only this
            browser view until a super-admin API is added — no real merchant is changed.
          </span>
        </div>
        {!isAdmin && (
          <div className="sa-role-banner" role="note">
            You are signed in as “{user.role || 'user'}”, not as a super-admin. This preview still renders for signed-in users, but real admin actions must be
            enforced server-side for role <code>admin</code> before they go live.
          </div>
        )}
        {notice && (
          <div className="sa-notice" role="status">
            {notice}
            <button type="button" onClick={() => setNotice('')}>Dismiss</button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {section === 'overview' && (
              <section className="sa-section" aria-label="Overview">
                <div className="sa-stats">
                  <TiltCard>
                    <span className="sa-stat-icon"><CircleDollarSign size={22} /></span>
                    <small>Total Revenue</small>
                    <strong>{formatBdt(totalRevenue)}<span>/month</span></strong>
                    <p>Monthly packages of active merchants in this demo set.</p>
                  </TiltCard>
                  <TiltCard>
                    <span className="sa-stat-icon"><Users size={22} /></span>
                    <small>Active Merchants</small>
                    <strong>{activeMerchants.length}<span> / {merchants.length} total</span></strong>
                    <p>{merchants.filter((item) => item.status === 'trial').length} on free trial · {merchants.filter((item) => item.status === 'suspended').length} suspended.</p>
                  </TiltCard>
                  <TiltCard>
                    <span className="sa-stat-icon"><Wifi size={22} /></span>
                    <small>Connected KashNode Boxes</small>
                    <strong>{connectedBoxes}<span> / {boxes.length} online</span></strong>
                    <p>Boxes reporting online in this demo set.</p>
                  </TiltCard>
                </div>
                <div className="sa-overview-grid">
                  <div className="sa-panel">
                    <h2>Packages at a glance</h2>
                    <ul className="sa-package-list">
                      {PACKAGES.map((item) => (
                        <li key={item.id}>
                          <span><strong>{item.name}</strong><small>{item.orders} orders · {item.minutes} minutes</small></span>
                          <strong>{formatBdt(item.price)}/mo</strong>
                          <small>{merchants.filter((merchant) => merchant.packageId === item.id).length} merchants</small>
                        </li>
                      ))}
                    </ul>
                    <p className="sa-panel-note">Overage is a flat ৳7/minute, with in-app minute recharge.</p>
                  </div>
                  <div className="sa-panel">
                    <h2>Quick actions</h2>
                    <div className="sa-quick-actions">
                      <button type="button" onClick={() => setSection('merchants')}>Manage merchants <ArrowUpRight size={15} /></button>
                      <button type="button" onClick={() => setSection('licensing')}>Review licensing &amp; packages <ArrowUpRight size={15} /></button>
                      <button type="button" onClick={() => setSection('hardware')}>Check hardware boxes <ArrowUpRight size={15} /></button>
                    </div>
                    <p className="sa-panel-note">Start with Merchants to upgrade a package or suspend a store.</p>
                  </div>
                </div>
              </section>
            )}

            {section === 'merchants' && (
              <section className="sa-section" aria-label="Merchants">
                <div className="sa-filters">
                  <label className="sa-search">
                    <Search size={17} />
                    <input type="search" placeholder="Search merchant, email or ID…" value={search} onChange={(event) => setSearch(event.target.value)} />
                  </label>
                  <label className="sa-filter">
                    <span>Status</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | MerchantStatus)}>
                      <option value="all">All statuses</option>
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </label>
                  <span className="sa-count">{filteredMerchants.length} merchants</span>
                </div>
                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Merchant</th>
                        <th>Package</th>
                        <th>Status</th>
                        <th>Boxes</th>
                        <th>Minutes left</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {filteredMerchants.map((merchant, index) => (
                          <motion.tr
                            key={merchant.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.03 }}
                          >
                            <td>
                              <strong>{merchant.name}</strong>
                              <small>{merchant.email}</small>
                              <small>{merchant.id}</small>
                            </td>
                            <td>
                              <select
                                className="sa-package-select"
                                aria-label={`Package for ${merchant.name}`}
                                value={merchant.packageId}
                                onChange={(event) => changePackage(merchant.id, event.target.value as PackageId)}
                              >
                                {PACKAGES.map((item) => (
                                  <option key={item.id} value={item.id}>{item.name} · {formatBdt(item.price)}/mo</option>
                                ))}
                              </select>
                            </td>
                            <td><span className={`sa-status ${merchant.status}`}>{merchant.status}</span></td>
                            <td>{merchant.boxes}</td>
                            <td>{merchant.minutesLeft.toLocaleString('en-US')} min</td>
                            <td>
                              <button type="button" className="sa-action" onClick={() => toggleSuspend(merchant)}>
                                {merchant.status === 'suspended' ? <><Play size={14} /> Reactivate</> : <><Pause size={14} /> Suspend</>}
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                      {filteredMerchants.length === 0 && (
                        <tr>
                          <td colSpan={6} className="sa-empty">No merchants match this search.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {section === 'licensing' && (
              <section className="sa-section" aria-label="Licensing and packages">
                <div className="sa-package-grid">
                  {PACKAGES.map((item, index) => (
                    <motion.article
                      key={item.id}
                      className="sa-package-card"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.06 }}
                      whileHover={{ y: -6, scale: 1.01 }}
                    >
                      <span className="sa-package-note">{item.note}</span>
                      <h2>{item.name}</h2>
                      <strong className="sa-package-price">{formatBdt(item.price)}<span>/month</span></strong>
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
                <p className="sa-panel-note">Licensing model: a monthly order package with minutes included inside it — cost is per minute, but sellers budget per order.</p>
              </section>
            )}

            {section === 'hardware' && (
              <section className="sa-section" aria-label="Hardware boxes">
                <div className="sa-box-grid">
                  {INITIAL_BOXES.map((box, index) => (
                    <motion.article
                      key={box.unit}
                      className="sa-box-card"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      whileHover={{ y: -6 }}
                    >
                      <div className="sa-box-head">
                        <span className="sa-box-icon"><Cpu size={20} /></span>
                        <span className={`sa-status ${box.online ? 'active' : 'suspended'}`}>{box.online ? 'Online' : 'Offline'}</span>
                      </div>
                      <h2>{box.unit}</h2>
                      <p>{box.merchant}</p>
                      <dl>
                        <div><dt>SIM</dt><dd>{box.sim}</dd></div>
                        <div><dt>Signal</dt><dd><Signal size={14} /> {box.signal}/5</dd></div>
                        <div><dt>WebSocket</dt><dd>{box.online ? `${box.latencyMs} ms` : '—'}</dd></div>
                        <div><dt>SMS today</dt><dd>{box.smsToday}</dd></div>
                      </dl>
                    </motion.article>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
