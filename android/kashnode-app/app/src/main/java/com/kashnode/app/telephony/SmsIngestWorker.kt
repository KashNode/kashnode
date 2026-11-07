package com.kashnode.app.telephony
import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.kashnode.app.data.local.AuthPreferences
import com.kashnode.app.data.local.DeviceRole
class SmsIngestWorker(c:Context,p:WorkerParameters):CoroutineWorker(c,p){override suspend fun doWork():Result{val s=AuthPreferences(applicationContext).session()?:return Result.success();if(inputData.getString("sender").isNullOrBlank()||inputData.getString("body").isNullOrBlank())return Result.success()
 // SMS forwarding is intentionally disabled until merchant matching policy is configured. Admin MFS crediting continues through its dedicated HMAC-signed collector.
 if(s.deviceRole==DeviceRole.ADMIN_GATEWAY)return Result.success();return Result.success()}}
