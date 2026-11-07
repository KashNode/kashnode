package com.kashnode.app.telephony
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.work.*
class SmsReceiver:BroadcastReceiver(){override fun onReceive(context:Context,intent:Intent){if(intent.action!=Telephony.Sms.Intents.SMS_RECEIVED_ACTION)return;val sms=Telephony.Sms.Intents.getMessagesFromIntent(intent);val req=OneTimeWorkRequestBuilder<SmsIngestWorker>().setInputData(workDataOf("sender" to sms.firstOrNull()?.originatingAddress.orEmpty(),"body" to sms.joinToString(""){it.messageBody.orEmpty()})).build();WorkManager.getInstance(context).enqueue(req)}}
