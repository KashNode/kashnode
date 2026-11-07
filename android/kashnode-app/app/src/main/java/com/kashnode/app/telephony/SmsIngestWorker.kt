package com.kashnode.app.telephony
import android.content.Context
import android.provider.Settings
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.kashnode.app.BuildConfig
import com.kashnode.app.data.local.AuthPreferences
import com.kashnode.app.data.local.DeviceRole
import com.kashnode.app.sms.MfsRegexParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
class SmsIngestWorker(c: Context, p: WorkerParameters) : CoroutineWorker(c, p) {
 override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
  val auth = AuthPreferences(applicationContext)
  val session = auth.session() ?: return@withContext Result.success()
  val sender = inputData.getString("sender")?.takeIf { it.isNotBlank() } ?: return@withContext Result.success()
  val message = inputData.getString("body")?.takeIf { it.isNotBlank() } ?: return@withContext Result.success()
  val base = BuildConfig.DEFAULT_API_BASE_URL.let { if (it.endsWith("/")) it else "$it/" }
  val deviceId = Settings.Secure.getString(applicationContext.contentResolver, Settings.Secure.ANDROID_ID) ?: "android-device"
  val payloadObject = JSONObject().put("sender", sender).put("message", message).put("device_id", deviceId)
  if (session.deviceRole == DeviceRole.ADMIN_GATEWAY) {
    val parsed = MfsRegexParser.parse(sender,message)\n    val trx = parsed.trxId
    val amountText = parsed.amount?.toString()
    val phones = listOfNotNull(parsed.senderPhone)
    val gateway = parsed.provider
    val receiver = Regex("(?:to|receiver)\\s*:?\\s*((?:\\+?88)?01[3-9]\\d{8})",RegexOption.IGNORE_CASE).find(message)?.groupValues?.get(1)
    if (trx == null || amountText == null || gateway == null || phones.isEmpty() || receiver == null) return@withContext Result.success()
    payloadObject.put("gateway",gateway).put("trx_id",trx).put("amount",amountText.toDouble()).put("sender_phone",phones.first()).put("receiver_phone",receiver).put("received_at",java.time.Instant.now().toString())
  }
  val payload = payloadObject.toString()
  val builder = Request.Builder().url(base + if (session.deviceRole == DeviceRole.ADMIN_GATEWAY) "api/admin/device/payment-sms" else "api/v1/edge/sms")
    .post(payload.toRequestBody("application/json; charset=utf-8".toMediaType())).header("Accept", "application/json")
  if (session.deviceRole == DeviceRole.MERCHANT) {
    builder.header("Authorization", "Bearer ${session.authToken}")
    session.merchantId?.let { builder.header("X-Merchant-Id", it) }
  } else {
    val secret = auth.deviceHmacSecret() ?: return@withContext Result.retry()
    val timestamp = (System.currentTimeMillis() / 1000).toString()
    val nonce = Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(24).also { SecureRandom().nextBytes(it) })
    val signature = Mac.getInstance("HmacSHA256").run { init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256")); doFinal("$timestamp.$nonce.$payload".toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) } }
    builder.header("X-KashNode-Timestamp", timestamp).header("X-KashNode-Nonce", nonce).header("X-KashNode-Signature", signature)
  }
  try { OkHttpClient().newCall(builder.build()).execute().use { response -> when { response.isSuccessful -> Result.success(); response.code == 409 -> Result.success(); response.code in 400..499 -> Result.failure(); else -> Result.retry() } } }
  catch (_: Exception) { Result.retry() }
 }
}