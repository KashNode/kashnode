package com.kashnode.app.telephony

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.telephony.SubscriptionManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import androidx.work.*

import com.kashnode.app.data.local.AuthPreferences

class SmsReceiver:BroadcastReceiver(){
 override fun onReceive(context:Context,intent:Intent){
  if(intent.action!=Telephony.Sms.Intents.SMS_RECEIVED_ACTION)return
  val auth=AuthPreferences(context)
  val selection=auth.smsMonitoringSimSelection()
  if(selection!=2 && ContextCompat.checkSelfPermission(context,Manifest.permission.READ_PHONE_STATE)==PackageManager.PERMISSION_GRANTED){
   val subscriptionId=intent.getIntExtra(SubscriptionManager.EXTRA_SUBSCRIPTION_INDEX,SubscriptionManager.INVALID_SUBSCRIPTION_ID)
   if(subscriptionId!=SubscriptionManager.INVALID_SUBSCRIPTION_ID){
    val manager=context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
    val slot=runCatching{manager.activeSubscriptionInfoList.orEmpty().firstOrNull{it.subscriptionId==subscriptionId}?.simSlotIndex}.getOrNull()
    if(slot!=null && slot!=selection)return
   }
  }
  val sms=Telephony.Sms.Intents.getMessagesFromIntent(intent)
  val req=OneTimeWorkRequestBuilder<SmsIngestWorker>()
   .setInputData(workDataOf("sender" to sms.firstOrNull()?.originatingAddress.orEmpty(),"body" to sms.joinToString(""){it.messageBody.orEmpty()}))
   .build()
  WorkManager.getInstance(context).enqueue(req)
 }
}
