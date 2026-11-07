import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Activity, Box, Building2, Check, ClipboardList, LayoutDashboard, Phone, RefreshCw, Settings, Truck, Wifi } from 'lucide-react'
import KashNodeLogo from '../components/KashNodeLogo'
import type { AuthUser } from '../lib/auth'
import { getAdminSystemSettings, saveAdminSystemSettings, type AdminSystemSettings, type LlmProvider } from '../lib/adminSettings'

type Props = { user: AuthUser; onSignOut: () => void }
type CatalogPlan = { slug:string; name:string; tagline:string; monthly_fee:string|number; included_minutes:number; price_per_minute:string|number; minimum_topup_minutes:number; short_features:string[]; details:string[]; feature_groups:{category:string;items:string[]}[]; is_active?:boolean; updated_at?:string }
type Section = 'overview' | 'merchants' | 'orders' | 'calls' | 'courier' | 'devices' | 'integrations' | 'reliability' | 'plans' | 'settings'
type LiveData = {
  source: 'database'; generatedAt: string
  summary: { merchants: number; onboardedMerchants: number; walletBalance: number; orders: Record<string, number | string>; calls: Record<string, number | string>; devices: { assigned: number; reporting: number; online: number }; sms: Record<string, number | string> }
  merchants: Array<{id:string;name:string;email:string;plan:string;walletBalance:number;voiceMinutes:number;availableOrders:number;onboardingComplete:boolean;boxDeviceId:string|null;boxFulfillmentStatus:string;gatewayPreference:string;createdAt:string}>
  orders: Array<Record<string, any>>; calls: Array<Record<string, any>>; devices: Array<Record<string, any>>
  courierOrders: Array<Record<string, any>>; integrations: Array<Record<string, any>>
  courierQueue: Array<Record<string, any>>; voiceQueue: Array<Record<string, any>>; transactions: Array<Record<string, any>>
}
const sections: {id:Section;label:string;icon:typeof LayoutDashboard}[] = [
  {id:'overview',label:'Overview',icon:LayoutDashboard},{id:'merchants',label:'Merchants',icon:Building2},
  {id:'orders',label:'Orders & Payments',icon:ClipboardList},{id:'calls',label:'Voice & Billing',icon:Phone},
  {id:'courier',label:'Courier',icon:Truck},{id:'devices',label:'KashNode Boxes',icon:Box},
  {id:'integrations',label:'Integrations',icon:Wifi},{id:'reliability',label:'Queues & Reliability',icon:Activity},
  {id:'plans',label:'Plans & Features',icon:ClipboardList},{id:'settings',label:'System Settings',icon:Settings},
]
const money=(value:unknown)=>'৳'+Number(value||0).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})
const date=(value:unknown)=>value?new Date(String(value)).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'—'
const cell=(value:unknown)=>value==null||value===''?'—':String(value)
function Stat({label,value,note}:{label:string;value:string;note:string}) { return <article className="cd-panel"><small className="cd-eyebrow">{label}</small><strong className="cd-live-stat">{value}</strong><p className="cd-panel-note">{note}</p></article> }
function Table({headers,rows,empty}:{headers:string[];rows:ReactNode[];empty:string}) { return <div className="cd-table-wrap"><table className="cd-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length?rows:<tr><td colSpan={headers.length} className="cd-empty">{empty}</td></tr>}</tbody></table></div> }

export default function AdminPanel({user,onSignOut}:Props) {
  const [section,setSection]=useState<Section>('overview')
  const [data,setData]=useState<LiveData|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [lastUpdated,setLastUpdated]=useState('')
  const [search,setSearch]=useState('')
  const [systemSettings,setSystemSettings]=useState<AdminSystemSettings|null>(null)
  const [settingsLoading,setSettingsLoading]=useState(false)
  const [settingsSaving,setSettingsSaving]=useState(false)
  const [settingsError,setSettingsError]=useState('')
  const [settingsProvider,setSettingsProvider]=useState<LlmProvider>('openai')
  const [defaultVoiceRate,setDefaultVoiceRate]=useState('7.00')
  const [providerKeys,setProviderKeys]=useState<Record<LlmProvider,string>>({openai:'',gemini:'',groq:''})
  const [clearProviderKeys,setClearProviderKeys]=useState<LlmProvider[]>([])
  const [notice,setNotice]=useState('')
  const [catalogPlans,setCatalogPlans]=useState<CatalogPlan[]>([])
  const [catalogLoading,setCatalogLoading]=useState(false)
  const [catalogError,setCatalogError]=useState('')
  const [planSaving,setPlanSaving]=useState('')
  const [planSaveErrors,setPlanSaveErrors]=useState<Record<string,string>>({})
  const [planDrafts,setPlanDrafts]=useState<Record<string,{monthly_fee:string;included_minutes:string;price_per_minute:string;minimum_topup_minutes:string;is_active:boolean}>>({})
  const [upgradeRequests,setUpgradeRequests]=useState<Array<Record<string,any>>>([])
  const [upgradeLoading,setUpgradeLoading]=useState(false)
  const [upgradeAction,setUpgradeAction]=useState('')
  const [upgradeError,setUpgradeError]=useState('')


  async function loadLiveData() {
    try {
      setError('')
      const response=await fetch('/api/admin/overview',{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'})
      const payload=await response.json()
      if(!response.ok) throw new Error(payload.message||'Could not load live admin data.')
      if(payload.source!=='database') throw new Error('The server did not confirm a database data source.')
      setData(payload as LiveData); setLastUpdated(new Date().toISOString())
    } catch(e) { setError(e instanceof Error?e.message:'Could not load live data.') }
    finally { setLoading(false) }
  }
  useEffect(()=>{void loadLiveData();const timer=window.setInterval(()=>void loadLiveData(),30000);return()=>window.clearInterval(timer)},[])
  useEffect(()=>{
    if(section!=='settings')return
    let active=true;setSettingsLoading(true);setSettingsError('')
    getAdminSystemSettings().then(value=>{if(!active)return;setSystemSettings(value);setSettingsProvider(value.activeLlmProvider);setDefaultVoiceRate(value.defaultVoiceRate.toFixed(2))})
      .catch(e=>{if(active)setSettingsError(e instanceof Error?e.message:'Could not load settings.')})
      .finally(()=>{if(active)setSettingsLoading(false)})
    return()=>{active=false}
  },[section])
  useEffect(()=>{
    if(section!=='plans')return
    let active=true;setCatalogLoading(true);setCatalogError('')
    fetch('/api/admin/plans',{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'})
      .then(async response=>{const payload=await response.json();if(!response.ok||payload.source!=='database'||!Array.isArray(payload.plans))throw new Error(payload.message||'Could not load database plan catalog.');if(active)setCatalogPlans(payload.plans)})
      .catch(e=>{if(active)setCatalogError(e instanceof Error?e.message:'Could not load plan catalog.')})
      .finally(()=>{if(active)setCatalogLoading(false)})
    return()=>{active=false}
  },[section])
  async function saveSettings(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(settingsSaving)return;setSettingsSaving(true);setSettingsError('')
    try {
      const apiKeys:Partial<Record<LlmProvider,string>>={}
      for(const provider of ['openai','gemini','groq'] as const)if(providerKeys[provider].trim())apiKeys[provider]=providerKeys[provider].trim()
      const saved=await saveAdminSystemSettings({activeLlmProvider:settingsProvider,defaultVoiceRate:Number(defaultVoiceRate),apiKeys,clearApiKeys:clearProviderKeys})
      setSystemSettings(saved);setProviderKeys({openai:'',gemini:'',groq:''});setClearProviderKeys([]);setNotice('System settings saved.')
    } catch(e){setSettingsError(e instanceof Error?e.message:'Could not save settings.')}
    finally{setSettingsSaving(false)}
  }
  async function loadUpgradeRequests() {
    setUpgradeLoading(true);setUpgradeError('')
    try { const response=await fetch('/api/admin/plan-upgrades',{credentials:'include',cache:'no-store'});const payload=await response.json();if(!response.ok)throw new Error(payload.message||'Could not load upgrade requests.');setUpgradeRequests(payload.requests||[]) }
    catch(e){setUpgradeError(e instanceof Error?e.message:'Could not load upgrade requests.')} finally{setUpgradeLoading(false)}
  }
  async function savePlan(plan:CatalogPlan) {
    const draft=planDrafts[plan.slug]
    if(!draft||planSaving)return
    setPlanSaving(plan.slug)
    setPlanSaveErrors(current=>({...current,[plan.slug]:''}))
    setNotice('')
    try {
      const response=await fetch('/api/admin/plans/'+encodeURIComponent(plan.slug),{
        method:'PUT',credentials:'include',
        headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({
          monthly_fee:draft.monthly_fee,
          included_minutes:draft.included_minutes,
          price_per_minute:draft.price_per_minute,
          minimum_topup_minutes:draft.minimum_topup_minutes,
          is_active:draft.is_active,
        }),
      })
      const payload=await response.json().catch(()=>({message:'The server returned an unreadable response.'}))
      if(!response.ok)throw new Error(payload.message||'Could not save plan (HTTP '+response.status+').')
      if(payload.source!=='database'||!payload.plan)throw new Error('The server did not confirm the saved database record.')
      setCatalogPlans(current=>current.map(item=>item.slug===plan.slug?{...item,...payload.plan}:item))
      setPlanDrafts(current=>({...current,[plan.slug]:{
        monthly_fee:String(payload.plan.monthly_fee??0),
        included_minutes:String(payload.plan.included_minutes??0),
        price_per_minute:String(payload.plan.price_per_minute??0),
        minimum_topup_minutes:String(payload.plan.minimum_topup_minutes??1),
        is_active:Boolean(payload.plan.is_active),
      }}))
      setNotice('Plan '+(payload.plan.name||plan.name)+' updated successfully.')
    } catch(e) {
      const message=e instanceof Error?e.message:'Could not save plan. Please try again.'
      setPlanSaveErrors(current=>({...current,[plan.slug]:message}))
    } finally {setPlanSaving('')}
  }
  async function reviewUpgrade(id:string,action:'approve'|'reject') {
    if(!window.confirm((action==='approve'?'Approve':'Reject')+' this plan upgrade request?'))return
    setUpgradeAction(id);setUpgradeError('')
    try {const response=await fetch('/api/admin/plan-upgrades/'+encodeURIComponent(id)+'/review',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});const payload=await response.json();if(!response.ok)throw new Error(payload.message||'Could not review request.');await loadUpgradeRequests();setNotice('Plan upgrade '+action+'d.')}
    catch(e){setUpgradeError(e instanceof Error?e.message:'Could not review request.')}finally{setUpgradeAction('')}
  }
  useEffect(()=>{if(section==='plans')void loadUpgradeRequests()},[section])
    const merchants=useMemo(()=>data?.merchants.filter(m=>[m.name,m.email,m.plan].join(' ').toLowerCase().includes(search.toLowerCase()))||[],[data,search])
  const title=sections.find(s=>s.id===section)?.label||'Overview'
  const summary=data?.summary
  const panel=(heading:string,sub:string,children:ReactNode)=><section className="cd-panel"><div className="cd-card-heading"><div><h2>{heading}</h2><p>{sub}</p></div><span className="cd-preview-chip">LIVE DATA</span></div>{children}</section>

  return <div className="cd-page">
    <div className="cd-shell">
      <aside className="cd-rail">
        <div className="cd-rail-brand"><KashNodeLogo/><span className="cd-admin-badge">SUPER ADMIN</span></div>
        <div className="cd-rail-foot"><strong><i/> Production workspace</strong><p>Live database-backed operations. Read-only operational views; settings are editable.</p></div>
        <nav className="cd-nav" aria-label="Admin sections">
          {sections.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" className={section===item.id?'active':''} onClick={()=>setSection(item.id)}><Icon size={17}/><span>{item.label}</span></button>})}
        </nav>
        <div className="cd-rail-user"><span className="cd-avatar">{(user.name?.[0]||user.email[0]||'A').toUpperCase()}</span><span className="cd-user-lines"><strong>{user.name||user.email}</strong><small>{user.email}</small></span></div>
        <button type="button" className="cd-signout" onClick={onSignOut}>Sign out</button>
      </aside>
      <main className="cd-main">
        <header className="cd-topbar"><div><p className="cd-eyebrow">KashNode · Super Admin</p><h1>{title}</h1><p className="cd-page-subtitle">Operational records loaded from the production database.</p></div>
          <div className="cd-top-actions"><span className="cd-status active">DATABASE CONNECTED</span><button className="cd-action" type="button" onClick={()=>{setLoading(true);void loadLiveData()}} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
        </header>
        {error&&<div className="cd-notice" role="alert">{error} <button onClick={()=>{setLoading(true);void loadLiveData()}}>Retry</button></div>}
        {notice&&<div className="cd-notice" role="status">{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}
        {loading&&!data?<div className="cd-panel">Loading live production records…</div>:!data?<div className="cd-panel">Live data is unavailable. No sample data is being substituted.</div>:<>
          {section==='overview'&&<div className="cd-section">
            <div className="cd-stats">
              <Stat label="Total merchants" value={String(summary?.merchants??0)} note={summary?.onboardedMerchants+' onboarding completed'}/>
              <Stat label="Merchant wallet balance" value={money(summary?.walletBalance)} note="Sum of current merchant wallet balances"/>
              <Stat label="Orders · last 30 days" value={String(summary?.orders?.last_30_days??0)} note={summary?.orders?.total+' total order records'}/>
              <Stat label="Voice calls · last 30 days" value={String(summary?.calls?.last_30_days??0)} note={money(summary?.calls?.billed_total)+' total billed in call ledger'}/>
              <Stat label="Boxes online" value={String(summary?.devices?.online??0)+' / '+String(summary?.devices?.assigned??0)} note={summary?.devices?.reporting+' devices have reported telemetry'}/>
              <Stat label="Unreconciled SMS" value={String(summary?.sms?.unreconciled??0)} note={summary?.sms?.last_24_hours+' SMS received in last 24 hours'}/>
            </div>
            {panel('Recent orders','Latest orders across all merchants',<Table headers={['Order','Merchant','Customer','Amount','Payment','Delivery','Created']} empty="No order records yet." rows={data.orders.slice(0,8).map(o=><tr key={o.id}><td>{cell(o.platform_order_id||o.id)}</td><td>{cell(o.business_name||o.merchant_name)}</td><td>{cell(o.customer_name)}</td><td>{money(o.total_amount)}</td><td>{cell(o.payment_status)}</td><td>{cell(o.delivery_status)}</td><td>{date(o.created_at)}</td></tr>)}/> )}
            {panel('Operational exceptions','Retryable work and billing jobs that need attention',<div className="cd-stats cd-stats-3"><Stat label="Courier fulfillment queue" value={String(data.courierQueue.reduce((n,r)=>n+Number(r.total),0))} note={data.courierQueue.map(r=>r.status+': '+r.total).join(' · ')||'No queued jobs'}/><Stat label="Voice billing jobs" value={String(data.voiceQueue.reduce((n,r)=>n+Number(r.total),0))} note={data.voiceQueue.map(r=>r.status+': '+r.total).join(' · ')||'No pending billing jobs'}/><Stat label="SMS awaiting reconciliation" value={String(summary?.sms?.unreconciled??0)} note="Live raw SMS inbox count"/></div>)}
          </div>}
          {section==='merchants'&&<div className="cd-section">{panel('Merchant directory','Real merchant records and current subscription / wallet state',<><label className="cd-search"><input placeholder="Search name, email or plan…" value={search} onChange={e=>setSearch(e.target.value)}/></label><Table headers={['Merchant','Email','Plan','Wallet','Voice minutes','Orders quota','Onboarding','Box']} empty="No merchants found." rows={merchants.map(m=><tr key={m.id}><td><strong>{m.name}</strong><small>{m.id}</small></td><td>{cell(m.email)}</td><td>{m.plan}</td><td>{money(m.walletBalance)}</td><td>{m.voiceMinutes}</td><td>{m.availableOrders}</td><td>{m.onboardingComplete?'Complete':'Pending'}</td><td>{cell(m.boxDeviceId||m.boxFulfillmentStatus)}</td></tr>)}/></>)}</div>}
          {section==='orders'&&<div className="cd-section">{panel('Orders & payment operations','Recent real orders and aggregate payment states',<><div className="cd-stats cd-stats-3"><Stat label="Total orders" value={String(summary?.orders?.total??0)} note="All persisted order rows"/><Stat label="Paid / completed" value={String(summary?.orders?.paid??0)} note="Payment status paid, completed or verified"/><Stat label="Phone verified" value={String(summary?.orders?.phone_verified??0)} note="Orders with phone verification flag"/></div><Table headers={['Order','Merchant','Amount','Payment','Delivery','AI call','Created']} empty="No order records yet." rows={data.orders.map(o=><tr key={o.id}><td>{cell(o.platform_order_id||o.id)}</td><td>{cell(o.business_name||o.merchant_name)}</td><td>{money(o.total_amount)}</td><td>{cell(o.payment_status)}</td><td>{cell(o.delivery_status)}</td><td>{cell(o.ai_call_status)}</td><td>{date(o.created_at)}</td></tr>)}/></>)}</div>}
          {section==='calls'&&<div className="cd-section">{panel('Voice sessions & billing ledger','Billed sessions from the durable call billing ledger',<><div className="cd-stats cd-stats-3"><Stat label="Total sessions" value={String(summary?.calls?.total??0)} note={summary?.calls?.last_30_days+' in last 30 days'}/><Stat label="Billed amount" value={money(summary?.calls?.billed_total)} note="Sum of ledger billed_amount"/><Stat label="Talk time" value={Math.round(Number(summary?.calls?.duration_seconds||0)/60)+' min'} note="Sum of recorded call duration"/></div><Table headers={['Session','Merchant','Order','Phone','Duration','Billed','Source','Created']} empty="No billed voice sessions yet." rows={data.calls.map(c=><tr key={c.id}><td>{String(c.id).slice(0,8)}</td><td>{cell(c.merchant_name)}</td><td>{cell(c.platform_order_id)}</td><td>{cell(c.customer_phone)}</td><td>{Math.round(Number(c.call_duration_seconds||0))} sec</td><td>{money(c.billed_amount)}</td><td>{cell(c.billing_source)}</td><td>{date(c.created_at)}</td></tr>)}/></>)}</div>}
          {section==='courier'&&<div className="cd-section">{panel('Courier fulfillment','Persisted courier bookings and latest fulfillment queue states',<><Table headers={['Order','Merchant','Courier','Tracking','Status','Charge','Created']} empty="No courier bookings yet." rows={data.courierOrders.map(c=><tr key={c.id}><td>{cell(c.order_code)}</td><td>{cell(c.merchant_name)}</td><td>{cell(c.courier_name)}</td><td>{cell(c.tracking_code||c.consignment_id)}</td><td>{cell(c.status)}</td><td>{money(c.delivery_charge)}</td><td>{date(c.created_at)}</td></tr>)}/><h3>Fulfillment worker queue</h3><Table headers={['Status','Jobs','Attempts']} empty="No fulfillment jobs." rows={data.courierQueue.map(r=><tr key={r.status}><td>{r.status}</td><td>{r.total}</td><td>{r.attempts}</td></tr>)}/></>)}</div>}
          {section==='devices'&&<div className="cd-section">{panel('KashNode Box telemetry','Latest persisted device report per merchant; online means heartbeat within 2 minutes',<Table headers={['Merchant','Assigned Box','Reported Device','Status','SIM balance','Data','Signal','Last heartbeat']} empty="No device telemetry has been received yet." rows={data.devices.map(d=><tr key={d.merchantId}><td>{cell(d.merchantName)}</td><td>{cell(d.assignedDeviceId)}</td><td>{cell(d.deviceId)}</td><td><span className={'cd-status '+(d.online?'active':'suspended')}>{d.deviceId?(d.online?'Online':'Offline'):'No report'}</span></td><td>{money(d.balance)}</td><td>{Number(d.dataMb||0).toLocaleString()} MB</td><td>{d.signal==null?'—':d.signal}</td><td>{date(d.updatedAt)}</td></tr>)}/>)}</div>}
          {section==='integrations'&&<div className="cd-section">{panel('Merchant integrations','Provider-level connection status; credentials are never exposed',<Table headers={['Provider','Configured','Active','Failed tests','Last updated']} empty="No merchant integrations configured yet." rows={data.integrations.map(i=><tr key={i.provider}><td>{i.provider}</td><td>{i.total}</td><td>{i.active}</td><td>{i.failed_tests}</td><td>{date(i.last_updated)}</td></tr>)}/>)}</div>}
          {section==='reliability'&&<div className="cd-section">{panel('Queue health & platform reliability','Actual background job states from Supabase',<><h3>Courier fulfillment</h3><Table headers={['Status','Jobs','Attempts']} empty="No courier queue records." rows={data.courierQueue.map(r=><tr key={r.status}><td>{r.status}</td><td>{r.total}</td><td>{r.attempts}</td></tr>)}/><h3>Voice billing recovery</h3><Table headers={['Status','Jobs','Attempts']} empty="No voice billing jobs." rows={data.voiceQueue.map(r=><tr key={r.status}><td>{r.status}</td><td>{r.total}</td><td>{r.attempts}</td></tr>)}/><h3>Payment transaction states</h3><Table headers={['Status','Transactions','Amount']} empty="No transaction records." rows={data.transactions.map(r=><tr key={r.status}><td>{r.status}</td><td>{r.total}</td><td>{money(r.amount)}</td></tr>)}/></>)}</div>}
          {section==='plans'&&<div className="cd-section">
            <div className="cd-settings-intro"><div><p className="cd-settings-kicker">DATABASE SUBSCRIPTION CATALOG</p><h2>Plans & feature comparison</h2><p>Live catalog shared with the public website. Changes to the database catalog are reflected in the pricing cards.</p></div><span className="cd-settings-live"><i/> DATABASE SOURCE</span></div>
            {catalogLoading&&<div className="cd-panel">Loading package catalog from database…</div>}
            {catalogError&&<div className="cd-notice" role="alert">{catalogError}</div>}
            {!catalogLoading&&!catalogError&&catalogPlans.length===0&&<div className="cd-panel">No subscription plans are configured in the database.</div>}
            {!catalogLoading&&!catalogError&&catalogPlans.length>0&&<>
              <div className="cd-panel">
                <div className="cd-card-heading"><div><h2>Voice usage rates</h2><p>Live values from public.subscription_plans.</p></div></div>
                <div className="cd-stats cd-stats-3">{catalogPlans.filter(p=>p.slug!=='free').map(plan=><Stat key={plan.slug} label={plan.name} value={money(plan.price_per_minute)+' / min'} note={plan.tagline}/>)}</div>
              </div>
              <div className="cd-panel">
                <div className="cd-card-heading"><div><h2>Feature comparison</h2><p>Included services grouped by category, sourced from the same database records as the homepage.</p></div></div>
                <div className="cd-table-wrap"><table className="cd-table cd-plan-matrix">
                  <thead><tr><th>Service category</th>{catalogPlans.filter(p=>p.slug!=='free').map(p=><th key={p.slug}>{p.name} · {money(p.price_per_minute)}</th>)}</tr></thead>
                  <tbody>{Array.from(new Set(catalogPlans.flatMap(p=>(p.feature_groups||[]).map(g=>g.category)))).map(category=><tr key={category}><td><strong>{category}</strong></td>{catalogPlans.filter(p=>p.slug!=='free').map(plan=>{const group=(plan.feature_groups||[]).find(g=>g.category===category);return <td key={plan.slug}>{group?<span className="cd-plan-included"><Check size={15}/>{group.items.join(' · ')}</span>:<span aria-label="Not included">—</span>}</td>})}</tr>)}
                  <tr><td><strong>Short feature list</strong></td>{catalogPlans.filter(p=>p.slug!=='free').map(p=><td key={p.slug}>{(p.short_features||[]).join(' · ')}</td>)}</tr>
                  <tr><td><strong>More details</strong></td>{catalogPlans.filter(p=>p.slug!=='free').map(p=><td key={p.slug}>{(p.details||[]).join(' ')}</td>)}</tr></tbody>
                </table></div>
                <div className="cd-panel-note">KashNode Box: ৳8,000 one-time hardware price, same for all packages.</div>
                <div className="cd-plan-edit-grid">{catalogPlans.map(plan=>{const draft=planDrafts[plan.slug]||{monthly_fee:String(plan.monthly_fee??0),included_minutes:String(plan.included_minutes??0),price_per_minute:String(plan.price_per_minute??0),minimum_topup_minutes:String(plan.minimum_topup_minutes??100),is_active:Boolean(plan.is_active)};return <form className="cd-settings-card" key={plan.slug} onSubmit={e=>{e.preventDefault();void savePlan(plan)}}><h3>{plan.name} · {plan.slug}</h3>
                  <label className="cd-settings-field"><span>Monthly fee (BDT)</span><input type="number" min="0" step="0.01" value={draft.monthly_fee} onChange={e=>setPlanDrafts(v=>({...v,[plan.slug]:{...draft,monthly_fee:e.target.value}}))}/></label>
                  <label className="cd-settings-field"><span>Included voice minutes</span><input type="number" min="0" step="1" value={draft.included_minutes} onChange={e=>setPlanDrafts(v=>({...v,[plan.slug]:{...draft,included_minutes:e.target.value}}))}/></label>
                  <label className="cd-settings-field"><span>Voice rate (BDT/min)</span><input type="number" min="0" step="0.01" value={draft.price_per_minute} onChange={e=>setPlanDrafts(v=>({...v,[plan.slug]:{...draft,price_per_minute:e.target.value}}))}/></label>
                  <label className="cd-settings-field"><span>Minimum top-up minutes</span><input type="number" min="1" step="1" value={draft.minimum_topup_minutes} onChange={e=>setPlanDrafts(v=>({...v,[plan.slug]:{...draft,minimum_topup_minutes:e.target.value}}))}/></label>
                  <label className="cd-settings-field"><span><input type="checkbox" checked={draft.is_active} onChange={e=>setPlanDrafts(v=>({...v,[plan.slug]:{...draft,is_active:e.target.checked}}))}/> Active plan</span></label>
                  {planSaveErrors[plan.slug]&&<p className="cd-settings-error" role="alert">{planSaveErrors[plan.slug]}</p>}
                  <button type="submit" className="cd-plan-save" disabled={Boolean(planSaving)} aria-busy={planSaving===plan.slug}>
                    {planSaving===plan.slug?<><RefreshCw size={15} className="cd-spin"/> Saving changes…</>: 'Save plan'}
                  </button></form>})}</div>
                {upgradeError&&<div className="cd-notice" role="alert">{upgradeError}</div>}
                <div className="cd-panel"><div className="cd-card-heading"><div><h2>Pending Plan Upgrades</h2><p>Review unmatched MFS payments and approve or reject requests.</p></div><button type="button" className="cd-action" onClick={()=>void loadUpgradeRequests()} disabled={upgradeLoading}>Refresh queue</button></div>
                  {upgradeLoading?<p>Loading pending requests…</p>:<Table headers={['Merchant','Target plan','TrxID','Gateway','Sender phone','Expected amount','Actions']} empty="No pending plan upgrades." rows={upgradeRequests.map(request=><tr key={request.id}><td>{cell(request.merchant_name)}</td><td>{cell(request.target_plan_name||request.requested_plan_slug)}</td><td>{cell(request.trx_id)}</td><td>{cell(request.gateway)}</td><td>{cell(request.sender_phone)}</td><td>{money(request.expected_amount)}</td><td><button type="button" disabled={Boolean(upgradeAction)} onClick={()=>void reviewUpgrade(request.id,'approve')}>{upgradeAction===request.id?'Working…':'Approve'}</button> <button type="button" disabled={Boolean(upgradeAction)} onClick={()=>void reviewUpgrade(request.id,'reject')}>Reject</button></td></tr>)}/>}
                </div>
              </div>
            </>}
          </div>}
          {section==='settings'&&<div className="cd-section">
            <div className="cd-settings-intro"><div><p className="cd-settings-kicker">PLATFORM CONFIGURATION</p><h2>AI provider & voice pricing</h2><p>Provider keys remain server-side in Supabase Vault.</p></div><span className="cd-settings-live"><i/> LIVE SETTINGS</span></div>
            {settingsError&&<p className="cd-settings-error" role="alert">{settingsError}</p>}
            {settingsLoading?<p>Loading current settings…</p>:<form className="cd-settings-form" onSubmit={saveSettings}>
              <div className="cd-settings-card"><h3>Active AI provider</h3><label className="cd-settings-field"><span>Default LLM provider</span><select value={settingsProvider} onChange={e=>setSettingsProvider(e.target.value as LlmProvider)}><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="groq">Groq</option></select></label><p>Current: {systemSettings?.activeLlmProvider}</p></div>
              <div className="cd-settings-card"><h3>Provider API keys</h3>{(['openai','gemini','groq'] as const).map(provider=><label className="cd-settings-field" key={provider}><span>{provider.toUpperCase()} · {systemSettings?.apiKeys[provider]?.configured?'Configured':'Not configured'}</span><input type="password" autoComplete="new-password" value={providerKeys[provider]} placeholder="Leave blank to keep saved key" onChange={e=>setProviderKeys(v=>({...v,[provider]:e.target.value}))}/>{systemSettings?.apiKeys[provider]?.configured&&<button type="button" className="cd-settings-remove" onClick={()=>setClearProviderKeys(v=>v.includes(provider)?v.filter(x=>x!==provider):[...v,provider])}>{clearProviderKeys.includes(provider)?'Will clear on save · undo':'Clear saved key'}</button>}</label>)}</div>
              <div className="cd-settings-card"><h3>Default voice rate</h3><label className="cd-settings-field"><span>BDT per minute</span><input type="number" min="0" max="10000" step="0.01" value={defaultVoiceRate} onChange={e=>setDefaultVoiceRate(e.target.value)} required/></label></div>
              <div className="cd-settings-actions"><button type="submit" disabled={settingsSaving}>{settingsSaving?'Saving…':'Save settings'}</button><span>Last saved: {date(systemSettings?.updatedAt)}</span></div>
            </form>}
          </div>}
          <p className="cd-panel-note">Data source: Supabase PostgreSQL · Last refreshed: {date(lastUpdated)} · Auto-refresh: 30 seconds. Empty tables show zero/empty state; demo records are never substituted.</p>
        </>}
      </main>
    </div>
  </div>
}
