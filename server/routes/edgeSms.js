import { parseMfsSms } from '../parsers/mfs.js'
const MAX_SENDER_LENGTH=50,MAX_MESSAGE_LENGTH=8000
export function createEdgeSmsHandler({pool,parser=parseMfsSms,onPersist=async()=>{}}){
 return async function ingestEdgeSms(req,res){
  if(!pool?.connect)return res.status(503).json({success:false,error:'Database unavailable.'})
  const native=req.nativeUser||req.session?.user;let merchantId=null
  if(native?.id&&native?.merchantId&&native.role!=='admin'){if(req.get('x-merchant-id')&&req.get('x-merchant-id')!==String(native.merchantId))return res.status(403).json({success:false,error:'Merchant session scope mismatch.'});merchantId=String(native.merchantId)}
  else{const secret=req.get('x-merchant-secret');if(typeof secret!=='string'||!secret||secret.length>255)return res.status(401).json({success:false,error:'Invalid merchant credentials.'});const found=await pool.query('SELECT id FROM merchants WHERE webhook_secret=$1 LIMIT 1',[secret]);merchantId=found.rows[0]?.id}
  if(!merchantId)return res.status(401).json({success:false,error:'Invalid merchant credentials.'})
  const {sender,message,received_at:receivedAt,sim_slot:simSlot}=req.body||{}
  if(typeof sender!=='string'||!sender.trim()||sender.trim().length>MAX_SENDER_LENGTH)return res.status(400).json({success:false,error:'A valid sender is required.'})
  if(typeof message!=='string'||!message.trim()||message.length>MAX_MESSAGE_LENGTH)return res.status(400).json({success:false,error:'A valid SMS message is required.'})
  if(simSlot!==undefined&&(!Number.isInteger(simSlot)||simSlot<1||simSlot>8))return res.status(400).json({success:false,error:'sim_slot must be an integer from 1 to 8.'})
  let timestamp=null;if(receivedAt!==undefined){if(typeof receivedAt!=='string'||!Number.isFinite(Date.parse(receivedAt)))return res.status(400).json({success:false,error:'received_at must be a valid timestamp.'});timestamp=new Date(receivedAt).toISOString()}
  const parsed=parser(sender.trim(),message),client=await pool.connect();let id
  try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[String(merchantId)])
   if(parsed.trxId){const dupe=await client.query('SELECT id FROM public.raw_sms_inbox WHERE merchant_id=$1 AND upper(parsed_trxid)=upper($2) LIMIT 1',[merchantId,parsed.trxId]);if(dupe.rows[0]){await client.query('COMMIT');return res.status(409).json({success:false,duplicate:true,error:'Transaction ID already recorded for this merchant.'})}
    const matched=await client.query('SELECT id FROM public.merchant_topups WHERE merchant_id=$1 AND upper(trx_id)=upper($2) LIMIT 1',[merchantId,parsed.trxId]);if(matched.rows[0]){await client.query('COMMIT');return res.status(409).json({success:false,duplicate:true,error:'Transaction ID already matched for this merchant.'})}}
   const inserted=await client.query('INSERT INTO public.raw_sms_inbox(merchant_id,sender_number,raw_message,parsed_trxid,parsed_amount,provider,customer_phone,is_reconciled,received_at) VALUES($1,$2,$3,$4,$5,$6,$7,FALSE,COALESCE($8::timestamptz,NOW())) RETURNING id',[merchantId,sender.trim(),message,parsed.trxId,parsed.amount,parsed.provider,parsed.customerPhone,timestamp]);id=inserted.rows[0]?.id;if(!id)throw new Error('SMS insert returned no ID');await client.query('COMMIT')
  }catch(e){await client.query('ROLLBACK').catch(()=>{});if(e.code==='23505')return res.status(409).json({success:false,duplicate:true,error:'Transaction ID already recorded.'});throw e}finally{client.release()}
  try{await onPersist(id)}catch(e){console.error('[KashNode] SMS reconciliation deferred:',e)}
  return res.status(201).json({success:true,id:String(id),parsed:{amount:parsed.amount,trxId:parsed.trxId,provider:parsed.provider,customerPhone:parsed.customerPhone}})
 }
}