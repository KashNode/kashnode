package com.kashnode.mfsgateway

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.work.BackoffPolicy\nimport androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.time.Instant\nimport java.util.concurrent.TimeUnit

class MfsSmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        Telephony.Sms.Intents.getMessagesFromIntent(intent).forEach { sms ->
            val sender = sms.originatingAddress.orEmpty()
            val body = sms.messageBody.orEmpty()
            val parsed = MfsParser.parse(sender, body) ?: return@forEach
            val input = Data.Builder()
                .putString("gateway", parsed.gateway)
                .putString("trx_id", parsed.trxId)
                .putString("amount", parsed.amount)
                .putString("sender_phone", parsed.senderPhone)
                .putString("receiver_phone", parsed.receiverPhone)
                .putString("received_at", Instant.ofEpochMilli(sms.timestampMillis).toString())
                .putString("message", parsed.rawMessage)
                .build()
            WorkManager.getInstance(context).enqueue(OneTimeWorkRequestBuilder<MfsUploadWorker>().setInputData(input).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build())
        }
    }
}
