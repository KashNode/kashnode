# KashNode MFS Android ingestion gateway

Private, dedicated collection-device application. It does not initiate payments or credit wallets; it forwards incoming provider notifications to the authenticated KashNode device endpoint.

## Build setup

Create an Android Studio project with minSdk 26, Kotlin, AndroidX WorkManager, and AndroidX Security Crypto. Add the Kotlin files in this directory to the app module (package `com.kashnode.mfsgateway`). Add WorkManager and AndroidX Security Crypto dependencies:

```kotlin
implementation("androidx.work:work-runtime-ktx:2.9.1")
implementation("androidx.security:security-crypto:1.1.0-alpha06")
```

Set `KASHNODE_MFS_ENDPOINT`, `KASHNODE_DEVICE_ID`, and the device bearer token/HMAC secret during a trusted device-enrollment flow. Store secrets in EncryptedSharedPreferences; do not hardcode them or commit them.

Enable Notification Access for KashNode MFS Gateway in Android Settings. Grant SMS permission only on the privately managed collection device. Android/OEM background restrictions may affect delivery; test on the exact production handset and SIMs.

The sample worker posts to `POST /api/admin/device/payment-sms` with:
- `Authorization: Bearer <device token>`
- `X-KashNode-Timestamp`
- `X-KashNode-Nonce`
- `X-KashNode-Signature`

Signature canonical string is exactly `timestamp.nonce.rawBody`, HMAC-SHA256 hex. Server requires the same 32+ byte device signing secret and checks timestamp freshness and nonce uniqueness.

Provider message formats vary. The parser deliberately refuses to guess missing sender numbers or receiver numbers. Validate patterns against redacted, real collection-SIM messages before enabling unattended crediting.

## Module configuration

Example app module Gradle configuration:

```kotlin
android {
  defaultConfig {
    buildConfigField("String", "KASHNODE_MFS_ENDPOINT", "\\\"https://YOUR_KASHNODE_HOST/api/admin/device/payment-sms\\\"")
    buildConfigField("String", "KASHNODE_DEVICE_ID", "\\\"kashnode-mfs-01\\\"")
  }
  buildFeatures { buildConfig = true }
}
```

The enrollment screen/service must write `bearer_token` and `hmac_secret` using `DeviceSecrets.prefs` (or an equivalent secure provisioning API). The worker uses encrypted preferences, exact-body HMAC, and WorkManager exponential backoff. Missing sender/receiver data fails closed; add a supervised review workflow for provider messages that do not expose those fields.
