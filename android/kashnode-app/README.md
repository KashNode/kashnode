# KashNode Android
Open in Android Studio (JDK 17, Android SDK 35, Gradle 8.9). API default `https://kashnode.com/`; configure with Gradle property `kashnodeApiBaseUrl` or login screen Server URL.
Apply native session/pairing SQL migration before deploying server changes. Native tokens expire in 30 days, are hash-stored server-side and encrypted on device. Pairing tokens are one-use and expire in five minutes. The WebView receives only a server-issued HttpOnly cookie.
Dual SIM/USSD and background execution depend on carrier, device and Android policy. No Android app can guarantee 24/7 operation against force-stop/OEM restrictions. SMS capture is not forwarded or used to credit payments without explicit signed server-side flows.
