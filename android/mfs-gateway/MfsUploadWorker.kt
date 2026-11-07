package com.kashnode.mfsgateway

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class MfsUploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val endpoint = BuildConfig.KASHNODE_MFS_ENDPOINT
        val deviceId = BuildConfig.KASHNODE_DEVICE_ID
        // Retrieve these from EncryptedSharedPreferences populated by device enrollment.
        val token = DeviceSecrets.bearerToken(applicationContext) ?: return Result.failure()
        val secret = DeviceSecrets.hmacSecret(applicationContext) ?: return Result.failure()
        val gateway = inputData.getString("gateway") ?: return Result.failure()
        val trxId = inputData.getString("trx_id") ?: return Result.failure()
        val sender = inputData.getString("sender_phone") ?: return Result.failure()
        val receiver = inputData.getString("receiver_phone") ?: when (gateway) {\n            "bKash" -> BuildConfig.KASHNODE_BKASH_RECEIVER\n            "Nagad" -> BuildConfig.KASHNODE_NAGAD_RECEIVER\n            "Rocket" -> BuildConfig.KASHNODE_ROCKET_RECEIVER\n            else -> null\n        } ?: return Result.failure()

        val payload = JSONObject().apply {
            put("gateway", gateway); put("trx_id", trxId)
            put("amount", inputData.getString("amount"))
            put("sender_phone", sender); put("receiver_phone", receiver)
            put("received_at", inputData.getString("received_at"))
            put("message", inputData.getString("message"))
            put("device_id", deviceId)
        }.toString()
        val timestamp = (System.currentTimeMillis() / 1000L).toString()
        val nonce = ByteArray(24).also { SecureRandom().nextBytes(it) }
            .joinToString("") { "%02x".format(it) }
        val signature = hmacSha256(secret, "$timestamp.$nonce.$payload")

        return try {
            val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"; connectTimeout = 15000; readTimeout = 15000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("X-KashNode-Timestamp", timestamp)
                setRequestProperty("X-KashNode-Nonce", nonce)
                setRequestProperty("X-KashNode-Signature", signature)
            }
            connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            connection.disconnect()
            when {
                status in 200..299 -> Result.success()
                status == 401 || status == 403 || status == 400 -> Result.failure()
                else -> Result.retry() // WorkManager applies exponential backoff.
            }
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private fun hmacSha256(secret: String, value: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        return mac.doFinal(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
}

/** Device credentials are encrypted at rest. Provision only through trusted enrollment. */
object DeviceSecrets {
    internal fun prefs(context: Context) = androidx.security.crypto.EncryptedSharedPreferences.create(
        context, "device-enrollment",
        androidx.security.crypto.MasterKey.Builder(context)
            .setKeyScheme(androidx.security.crypto.MasterKey.KeyScheme.AES256_GCM).build(),
        androidx.security.crypto.EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        androidx.security.crypto.EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    fun bearerToken(context: Context): String? = prefs(context).getString("bearer_token", null)
    fun hmacSecret(context: Context): String? = prefs(context).getString("hmac_secret", null)
}
