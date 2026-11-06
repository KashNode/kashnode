# Kash AI Android release drop location

Place the signed production Android package at:

`public/downloads/kash-ai-android.apk`

The application serves it at:

`https://kashnode.com/downloads/kash-ai-android.apk`

Until the signed APK is published, the route returns HTTP 503 with an explicit `ANDROID_APK_NOT_PUBLISHED` response. Do not commit unsigned, debug, or test APKs here.
