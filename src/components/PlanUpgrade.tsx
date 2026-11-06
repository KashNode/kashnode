import { useEffect, useState, type FormEvent } from 'react'

type Plan = { slug:string; name:string; monthly_fee:number|string; included_minutes:number; price_per_minute:number|string; minimum_topup_minutes:number; currency:string }
type Destination = { provider:string; account_label:string; phone_number:string }
type Props = { onClose?:()=>void; currentPlan?:string }

export default function PlanUpgrade({ currentPlan }: Props) {
  const [open,setOpen]=useState(false)
  const [plans,setPlans]=useState<Plan[]>([])
  const [destinations,setDestinations]=useState<Destination[]>([])
  const [selected,setSelected]=useState<Plan|null>(null)
  const [sender,setSender]=useState('')
  const [gateway,setGateway]=useState('bKash')
  const [trxId,setTrxId]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')

  useEffect(()=>{ if(!open)return; let active=true; setLoading(true); setError(''); setSelected(null); setNotice('')
    fetch('/api/merchant/billing-config',{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'})
      .then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p.message||'Could not load plan catalog.');if(active){setPlans(Array.isArray(p.plans)?p.plans:[]);setDestinations(Array.isArray(p.destinations)?p.destinations:[])}})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load plans.')})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[open])

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!selected)return;setBusy(true);setError('')
    try{
      const response=await fetch('/api/merchant/plan-upgrade',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({plan_slug:selected.slug,sender_phone:sender,gateway,trx_id:trxId.trim()})})
      const payload=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(payload.message||'Could not submit upgrade request.')
      setNotice(`Upgrade request to ${selected.name} submitted and pending verification.`)
      setSelected(null);setSender('');setTrxId('')
    }catch(e){setError(e instanceof Error?e.message:'Could not submit upgrade request.')}
    finally{setBusy(false)}
  }

  return <>
    <button className="md-secondary" type="button" onClick={()=>setOpen(true)}>Upgrade Plan</button>
    {open&&<div className="md-plan-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <section className="md-plan-modal md-card" role="dialog" aria-modal="true" aria-labelledby="md-plan-title">
        <div className="md-card-top"><div><h2 id="md-plan-title">Choose your plan</h2><p className="md-muted">Plan details and prices are loaded from the active database catalog.</p></div><button type="button" className="md-secondary" onClick={()=>setOpen(false)}>Close</button></div>
        {loading&&<p className="md-muted">Loading plans…</p>}
        {error&&<p className="md-error" role="alert">{error}</p>}
        {notice&&<p className="md-success" role="status">{notice}</p>}
        {!loading&&<div className="md-plan-grid">{plans.map(plan=><article className="md-card" key={plan.slug}>
          <div className="md-card-top"><strong>{plan.name}</strong>{currentPlan?.toLowerCase()===plan.slug.toLowerCase()&&<span className="md-badge">Current plan</span>}</div>
          <p><strong>৳{Number(plan.monthly_fee).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong> / month</p>
          <p>{plan.included_minutes} included minutes</p>
          <p>৳{Number(plan.price_per_minute).toFixed(2)} / extra minute</p>
          <p>Minimum top-up: {plan.minimum_topup_minutes} minutes</p>
          <button className="md-primary" type="button" disabled={currentPlan?.toLowerCase()===plan.slug.toLowerCase()} onClick={()=>setSelected(plan)}>Select plan</button>
        </article>)}</div>}
        {selected&&<form className="md-card md-upgrade-payment" onSubmit={submit}>
          <strong>Manual payment for {selected.name}</strong>
          <p className="md-muted">Send Money to one of the official KashNode accounts below. Your plan changes only after admin verification.</p>
          {destinations.length?destinations.map((d,i)=><p key={i}><strong>{d.provider} · {d.account_label}:</strong> {d.phone_number}</p>):<p className="md-warn">No payment destination is configured. Please contact KashNode support; do not send payment to an unverified number.</p>}
          <div className="md-topup-grid">
            <label className="md-topup-field"><span>Sender mobile number</span><input required type="tel" value={sender} onChange={e=>setSender(e.target.value)} placeholder="01XXXXXXXXX"/></label>
            <label className="md-topup-field"><span>Gateway</span><select value={gateway} onChange={e=>setGateway(e.target.value)}><option>bKash</option><option>Nagad</option><option>Rocket</option></select></label>
            <label className="md-topup-field"><span>Transaction ID (TrxID)</span><input required minLength={5} maxLength={40} value={trxId} onChange={e=>setTrxId(e.target.value.toUpperCase())}/></label>
          </div>
          <button className="md-primary" type="submit" disabled={busy||!destinations.length}>{busy?'Submitting…':'Submit Upgrade Request'}</button>
        </form>}
      </section>
    </div>}
  </>
}
