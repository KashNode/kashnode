package com.kashnode.mfsgateway

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.work.BackoffPolicy
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.time.Instant
import java.util.concurrent.TimeUnit

class MfsNotificationListener : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName.lowercase()
        val providerSource = when {
            "bkash" in packageName -> "bKash"
            "nagad" in packageName -> "Nagad"
            "rocket" in packageName || "dbbl" in packageName -> "Rocket"
            else -> return
        }
        val extras = sbn.notification.extras
        val title = extras.getCharSequence("android.title")?.toString().orEmpty()
        val body = extras.getCharSequence("android.text")?.toString().orEmpty()
        val text = listOf(title, body).filter { it.isNotBlank() }.joinToString("
")
        val parsed = MfsParser.parse(providerSource, text) ?: return
        val input = Data.Builder()
            .putString("gateway", parsed.gateway)
            .putString("trx_id", parsed.trxId)
            .putString("amount", parsed.amount)
            .putString("sender_phone", parsed.senderPhone)
            .putString("receiver_phone", parsed.receiverPhone)
            .putString("received_at", Instant.ofEpochMilli(sbn.postTime).toString())
            .putString("message", parsed.rawMessage)
            .build()
        WorkManager.getInstance(this).enqueue(OneTimeWorkRequestBuilder<MfsUploadWorker>().setInputData(input).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build())
    }
}
