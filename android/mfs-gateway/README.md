# KashNode MFS Android ingestion gateway

Private, dedicated collection-device application. It does not initiate payments or credit wallets; it forwards incoming provider notifications to the authenticated KashNode device endpoint.

## Build setup

Create an Android Studio project with minSdk 26, Kotlin, AndroidX WorkManager, and AndroidX Security Crypto. Add the Kotlin files in this directory to the app module (package `com.kashnode.mfsgateway`). Add:

```kotlin
implementation("androidx.work:work-runtime-ktx:2.9.1")
implementation("androidx.security:security-crypto:1.1.0-alpha06")
```

Configure the app module:

```kotlin
android {
  defaultConfig {
    buildConfigField("String", "KASHNODE_MFS_ENDPOINT", "\"https://YOUR_KASHNODE_HOST/api/admin/device/payment-sms\"")
    buildConfigField("String", "KASHNODE_DEVICE_ID", "\"kashnode-mfs-01\"")
    buildConfigField("String", "KASHNODE_BKASH_RECEIVER", "\"01XXXXXXXXX\"")
    buildConfigField("String", "KASHNODE_NAGAD_RECEIVER", "\"01XXXXXXXXX\"")
    buildConfigField("String", "KASHNODE_ROCKET_RECEIVER", "\"01XXXXXXXXX\"")
  }
  buildFeatures { buildConfig = true }
}
```

Set a unique device bearer token and HMAC secret during a trusted enrollment flow. Store them in `DeviceSecrets.prefs` (EncryptedSharedPreferences); never hardcode or commit secrets. The endpoint and device ID above are build-time configuration, not secrets.

Enable Notification Access for KashNode MFS Gateway in Android Settings. Grant SMS permission only on the privately managed collection device. Android/OEM background restrictions may affect delivery; test on the exact production handset and SIMs.

The sample worker posts to `POST /api/admin/device/payment-sms` with:
- `Authorization: Bearer <device token>`
- `X-KashNode-Timestamp`
- `X-KashNode-Nonce`
- `X-KashNode-Signature`

The signature is HMAC-SHA256 over the exact UTF-8 string `timestamp.nonce.rawBody`. The server checks a 5-minute timestamp window and persists nonces to reject replay.

Provider message formats vary. The parser deliberately refuses to guess missing sender numbers or receiver numbers. Validate patterns against redacted, real collection-SIM messages before enabling unattended crediting. Notifications and SMS may both report one transaction; the backend TrxID unique constraint deduplicates them.
