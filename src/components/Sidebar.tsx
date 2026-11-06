import { useLocation, NavLink } from 'react-router-dom'
import { Bell, Box, Home, Link2, PhoneCall, Settings, ShieldCheck, ShoppingBag, Wallet } from 'lucide-react'

type Props = { variant: 'desktop' | 'mobile' }
const isWithin = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

export default function Sidebar({ variant }: Props) {
  const { pathname } = useLocation()
  const integrationsOpen = isWithin(pathname, '/dashboard/integrations')
  const settingsOpen = isWithin(pathname, '/dashboard/settings')
  const mobile = variant === 'mobile'

  return (
    <nav className={mobile ? 'md-nav md-route-nav-mobile' : 'md-desktop-nav md-route-nav'} aria-label={mobile ? 'Merchant navigation' : 'Merchant sidebar navigation'}>
      <NavLink to="/dashboard" end className={({ isActive }) => isActive ? 'active' : ''}>
        <Home size={mobile ? 20 : 18} /><span>Overview</span>{mobile && <i className="md-nav-dot" />}
      </NavLink>
      <NavLink to="/dashboard/orders" className={({ isActive }) => isActive ? 'active' : ''}>
        <ShoppingBag size={mobile ? 20 : 18} /><span>Orders</span>{mobile && <i className="md-nav-dot" />}
      </NavLink>
      {mobile && <NavLink to="/dashboard/integrations" className={() => integrationsOpen ? 'active' : ''}><Link2 size={20} /><span>Integrations</span><i className="md-nav-dot" /></NavLink>}
      {!mobile && (
        <div className={`md-route-group ${integrationsOpen ? 'expanded' : ''}`}>
          <NavLink to="/dashboard/integrations" className={() => integrationsOpen ? 'active' : ''}><Link2 size={18} /><span>Integrations</span></NavLink>
          {integrationsOpen && <div className="md-route-subnav">
            <NavLink to="/dashboard/integrations/couriers" className={({ isActive }) => isActive || pathname === '/dashboard/integrations' ? 'active' : ''}>Couriers</NavLink>
            <NavLink to="/dashboard/integrations/stores" className={({ isActive }) => isActive ? 'active' : ''}>E-Commerce Stores</NavLink>
            <NavLink to="/dashboard/integrations/webhooks" className={({ isActive }) => isActive ? 'active' : ''}>Webhooks &amp; API</NavLink>
          </div>}
        </div>
      )}
      <NavLink to="/dashboard/box" className={({ isActive }) => isActive ? 'active' : ''}>
        <Box size={mobile ? 20 : 18} /><span>KashNode Box</span>{mobile && <i className="md-nav-dot" />}
      </NavLink>
      <NavLink to="/dashboard/wallet" className={({ isActive }) => isActive ? 'active' : ''}>
        <Wallet size={mobile ? 20 : 18} /><span>Wallet</span>{mobile && <i className="md-nav-dot" />}
      </NavLink>
      <NavLink to="/dashboard/calls" className={({ isActive }) => isActive ? 'active' : ''}>
        <PhoneCall size={mobile ? 20 : 18} /><span>Calls</span>{mobile && <i className="md-nav-dot" />}
      </NavLink>
      {mobile && <NavLink to="/dashboard/settings" className={() => settingsOpen ? 'active' : ''}><Settings size={20} /><span>Settings</span><i className="md-nav-dot" /></NavLink>}
      {!mobile && (
        <div className={`md-route-group ${settingsOpen ? 'expanded' : ''}`}>
          <NavLink to="/dashboard/settings" className={() => settingsOpen ? 'active' : ''}><Settings size={18} /><span>Settings</span></NavLink>
          {settingsOpen && <div className="md-route-subnav">
            <NavLink to="/dashboard/settings/profile" className={({ isActive }) => isActive || pathname === '/dashboard/settings' ? 'active' : ''}>Workspace Profile</NavLink>
            <NavLink to="/dashboard/settings/billing" className={({ isActive }) => isActive ? 'active' : ''}>Billing &amp; MFS</NavLink>
            <NavLink to="/dashboard/settings/api" className={({ isActive }) => isActive ? 'active' : ''}><ShieldCheck size={14} /> Security &amp; API Keys</NavLink>
          </div>}
        </div>
      )}
      <NavLink to="/dashboard/alerts" className={({ isActive }) => isActive ? 'active' : ''}>
        <Bell size={mobile ? 20 : 18} /><span>Alerts</span>{mobile && <i className="md-nav-dot" />}
      </NavLink>
      {mobile && integrationsOpen && <div className="md-route-mobile-subnav">
        <NavLink to="/dashboard/integrations/couriers">Couriers</NavLink>
        <NavLink to="/dashboard/integrations/stores">Stores</NavLink>
        <NavLink to="/dashboard/integrations/webhooks">Webhooks</NavLink>
      </div>}
      {mobile && settingsOpen && <div className="md-route-mobile-subnav">
        <NavLink to="/dashboard/settings/profile">Profile</NavLink>
        <NavLink to="/dashboard/settings/billing">Billing</NavLink>
        <NavLink to="/dashboard/settings/api">API Keys</NavLink>
      </div>}
    </nav>
  )
}
