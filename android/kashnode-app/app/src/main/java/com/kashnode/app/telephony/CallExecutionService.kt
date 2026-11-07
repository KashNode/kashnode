package com.kashnode.app.telephony

import android.app.*
import android.content.*
import android.net.Uri
import android.os.*
import android.telecom.TelecomManager
import android.telephony.*
import androidx.core.app.NotificationCompat
import com.kashnode.app.BuildConfig
import com.kashnode.app.data.local.AuthPreferences
import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class CallExecutionService:Service(){
 private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO)
 private val http=OkHttpClient.Builder().callTimeout(20,TimeUnit.SECONDS).build()
 private var current:JSONObject?=null
 private var answeredAt:Long?=null
 private var sawCallActivity=false
 private var callListener:Any?=null
 private var pollJob:Job?=null
 override fun onBind(intent:Intent?)=null
 override fun onCreate(){super.onCreate();createChannel();startForeground(71,notification("Call automation is ready"));pollJob=scope.launch{while(isActive){if(current==null)pollPending();delay(12000)}}}
 override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int{
  if(intent?.action==ACTION_APPROVE){val json=intent.getStringExtra("call_json")?.let{runCatching{JSONObject(it)}.getOrNull()};if(json!=null)scope.launch{dial(json)}}
  return START_STICKY
 }
 private fun auth()=AuthPreferences(this).session()
 private fun base()=BuildConfig.DEFAULT_API_BASE_URL.let{if(it.endsWith("/"))it else "$it/"}
 private fun request(path:String):Request.Builder{val s=auth()?:throw IllegalStateException("Device is not signed in");return Request.Builder().url(base()+path).header("Authorization","Bearer ${s.authToken}").header("X-Merchant-Id",s.merchantId.orEmpty())}
 private suspend fun pollPending(){
  val s=auth()?:return
  if(s.merchantId.isNullOrBlank())return
  try{http.newCall(request("api/v1/edge/calls/pending").get().build()).execute().use{r->if(r.code==204||!r.isSuccessful)return;val call=JSONObject(r.body?.string().orEmpty());if(AuthPreferences(this).autoDialEnabled())dial(call)else showApproval(call)}}catch(_:Exception){}
 }
 private fun showApproval(call:JSONObject){
  val intent=Intent(this,CallExecutionService::class.java).setAction(ACTION_APPROVE).putExtra("call_json",call.toString())
  val pi=PendingIntent.getService(this,call.optString("call_id").hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  val n=NotificationCompat.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.sym_action_call).setContentTitle("Order confirmation call").setContentText("Call ${call.optString("customer_name","customer")} at ${call.optString("customer_phone")}").setPriority(NotificationCompat.PRIORITY_MAX).setCategory(NotificationCompat.CATEGORY_CALL).addAction(android.R.drawable.sym_action_call,"Approve & dial",pi).setAutoCancel(true).build()
  (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(call.optString("call_id").hashCode(),n)
 }
 private suspend fun dial(call:JSONObject){
  if(current!=null)return
  current=call;answeredAt=null;sawCallActivity=false
  val phone=call.optString("customer_phone").filter{it.isDigit()||it=='+'}
  if(phone.length<8){finish("no_answer",0);return}
  try{
   registerCallState()
   val tm=getSystemService(TELECOM_SERVICE) as TelecomManager
   val subs=getSystemService(TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
   val slot=AuthPreferences(this).primaryCallSimSlot()
   val sub=subs.activeSubscriptionInfoList?.firstOrNull{it.simSlotIndex==slot}
   val account=tm.callCapablePhoneAccounts.firstOrNull{h->sub!=null&&(h.id==sub.subscriptionId.toString()||h.id.contains(sub.iccId.takeLast(4)))}
   val uri=Uri.fromParts("tel",phone,null)
   val intent=Intent(Intent.ACTION_CALL,uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
   if(account!=null)intent.putExtra(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE,account)
   intent.putExtra("kashnode_sim_slot",slot+1)
   startActivity(intent)
   updateNotification("Calling $phone")
  }catch(_:SecurityException){finish("no_answer",0)}catch(_:Exception){finish("no_answer",0)}
 }
 private fun registerCallState(){
  val telephony=getSystemService(TELEPHONY_SERVICE) as TelephonyManager
  if(Build.VERSION.SDK_INT>=31){
   val callback=object:TelephonyCallback(),TelephonyCallback.CallStateListener{
    override fun onCallStateChanged(state:Int){onState(state)}
   }
   if(Build.VERSION.SDK_INT>=31)telephony.registerTelephonyCallback(mainExecutor,callback)
   callListener=callback
  }else{
   @Suppress("DEPRECATION")
   val listener=object:PhoneStateListener(){@Deprecated("Deprecated") override fun onCallStateChanged(state:Int,number:String?){onState(state)}}
   @Suppress("DEPRECATION") telephony.listen(listener,PhoneStateListener.LISTEN_CALL_STATE)
   callListener=listener
  }
 }
 private fun onState(state:Int){
  when(state){
   TelephonyManager.CALL_STATE_OFFHOOK->{sawCallActivity=true;if(answeredAt==null)answeredAt=System.currentTimeMillis();updateNotification("Call connected")}
   TelephonyManager.CALL_STATE_IDLE->{if(current!=null&&sawCallActivity){val start=answeredAt;val seconds=if(start==null)0 else ((System.currentTimeMillis()-start)/1000L).coerceAtLeast(0).toInt();scope.launch{finish(if(start==null)"no_answer" else "completed",seconds)}}}
   TelephonyManager.CALL_STATE_RINGING->{sawCallActivity=true;updateNotification("Ringing")}
  }
 }
 private suspend fun finish(status:String,seconds:Int){
  val call=current?:return;current=null;unregisterCallState()
  val slot=AuthPreferences(this).primaryCallSimSlot()+1
  val payload=JSONObject().put("duration_seconds",seconds).put("call_status",status).put("sim_slot",slot)
  try{http.newCall(request("api/v1/edge/calls/${call.getString("call_id")}/complete").post(okhttp3.RequestBody.create(okhttp3.MediaType.parse("application/json"),payload.toString())).build()).execute().close()}catch(_:Exception){}
  updateNotification(if(status=="completed")"Call finished: $seconds seconds" else "Call ended: $status")
 }
 private fun unregisterCallState(){
  val telephony=getSystemService(TELEPHONY_SERVICE) as TelephonyManager
  when(val l=callListener){is TelephonyCallback->if(Build.VERSION.SDK_INT>=31)telephony.unregisterTelephonyCallback(l);is PhoneStateListener->{@Suppress("DEPRECATION") telephony.listen(l,PhoneStateListener.LISTEN_NONE)}}
  callListener=null
 }
 private fun createChannel(){if(Build.VERSION.SDK_INT>=26)(getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(NotificationChannel(CHANNEL,"KashNode calls",NotificationManager.IMPORTANCE_HIGH))}
 private fun notification(text:String)=NotificationCompat.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.sym_action_call).setContentTitle("KashNode Auto Dial").setContentText(text).setOngoing(true).build()
 private fun updateNotification(text:String){(getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(71,notification(text))}
 override fun onDestroy(){pollJob?.cancel();unregisterCallState();scope.cancel();super.onDestroy()}
 companion object{const val CHANNEL="kashnode_calls";const val ACTION_APPROVE="com.kashnode.app.APPROVE_CALL"}
}
