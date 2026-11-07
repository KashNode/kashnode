import { randomUUID } from 'node:crypto';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function identity(req){const u=req.nativeUser||req.session?.user;return u?.id&&u?.merchantId&&u.role!=='admin'?{userId:String(u.id),merchantId:String(u.merchantId)}:null}
export function createEdgeCallHandlers({pool,leaseSeconds=90}={}){
 async function pending(req,res){
  const who=identity(req);if(!who)return res.status(401).json({error:'Native merchant session required.'});
  if(!pool?.connect)return res.status(503).json({error:'Call queue unavailable.'});
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const picked=await c.query(`SELECT o.id AS order_id,o.customer_phone,o.customer_name,o.total_amount
     FROM public.orders o
     WHERE o.merchant_id=$1 AND (o.ai_call_status='pending' OR (o.ai_call_status='dispatching' AND EXISTS(SELECT 1 FROM public.edge_voice_calls expired WHERE expired.order_id=o.id AND expired.status IN ('dispatching','dialing') AND expired.lease_expires_at<=NOW())))
       AND COALESCE(o.customer_phone,'')<>''
       AND NOT EXISTS(SELECT 1 FROM public.edge_voice_calls v WHERE v.order_id=o.id AND (v.status IN ('completed','busy','no_answer') OR (v.status IN ('dispatching','dialing') AND v.lease_expires_at>NOW())))
     ORDER BY o.created_at ASC
     LIMIT 1 FOR UPDATE OF o SKIP LOCKED`,[who.merchantId]);
   const order=picked.rows[0];
   if(!order){await c.query('COMMIT');return res.status(204).end()}
   const callId=randomUUID(),sessionId=randomUUID();
   await c.query(`INSERT INTO public.edge_voice_calls(call_id,session_id,merchant_id,order_id,customer_phone,customer_name,total_amount,status,lease_expires_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,'dispatching',NOW()+($8::int*INTERVAL '1 second'))`,[callId,sessionId,who.merchantId,order.order_id,order.customer_phone,order.customer_name,order.total_amount,leaseSeconds]);
   await c.query("UPDATE public.orders SET ai_call_status='dispatching' WHERE id=$1 AND merchant_id=$2",[order.order_id,who.merchantId]);
   await c.query('COMMIT');
   return res.json({call_id:callId,order_id:String(order.order_id),customer_phone:order.customer_phone,customer_name:order.customer_name,total_amount:String(order.total_amount),session_id:sessionId});
  }catch(e){await c.query('ROLLBACK').catch(()=>{});if(e?.code==='42P01')return res.status(503).json({error:'Call queue migration is not applied.'});throw e}finally{c.release()}
 }
 async function complete(req,res){
  const who=identity(req);if(!who)return res.status(401).json({error:'Native merchant session required.'});
  const callId=String(req.params.call_id||'');if(!UUID_RE.test(callId))return res.status(400).json({error:'Invalid call ID.'});
  const {duration_seconds:duration,call_status:status,sim_slot:slot}=req.body||{};
  if(!Number.isInteger(duration)||duration<0||duration>86400||!['completed','no_answer','busy'].includes(status)||!Number.isInteger(slot)||slot<1||slot>2)return res.status(400).json({error:'Invalid call completion payload.'});
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const found=await c.query(`SELECT call_id,session_id,order_id,status FROM public.edge_voice_calls
     WHERE call_id=$1 AND merchant_id=$2 FOR UPDATE`,[callId,who.merchantId]);
   const call=found.rows[0];if(!call){await c.query('ROLLBACK');return res.status(404).json({error:'Call not found.'})}
   if(call.status==='completed'||call.status==='no_answer'||call.status==='busy'){await c.query('COMMIT');return res.json({success:true,idempotent:true})}
   let billing=null;
   if(status==='completed'&&duration>0){
    const charged=await c.query('SELECT * FROM public.finalize_voice_call_billing($1::uuid,$2::uuid,$3::uuid,$4::numeric)',[who.merchantId,call.order_id,call.session_id,duration]);
    billing=charged.rows[0]||null;
   }
   await c.query(`UPDATE public.edge_voice_calls SET status=$2,duration_seconds=$3,sim_slot=$4,completed_at=NOW(),lease_expires_at=NULL
     WHERE call_id=$1`,[callId,status,duration,slot]);
   await c.query('UPDATE public.orders SET ai_call_status=$2 WHERE id=$1 AND merchant_id=$3',[call.order_id,status==='completed'?'completed':status==='busy'?'busy':'no_answer',who.merchantId]);
   await c.query('COMMIT');
   return res.json({success:true,billing:billing?{ledger_id:billing.id,billed_amount:billing.billed_amount,billing_source:billing.billing_source}:null});
  }catch(e){await c.query('ROLLBACK').catch(()=>{});if(e?.code==='42P01')return res.status(503).json({error:'Call queue migration is not applied.'});throw e}finally{c.release()}
 }
 return{pending,complete}
}
