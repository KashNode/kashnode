package com.kashnode.app.data.remote
import android.content.Context
import android.provider.Settings
import com.kashnode.app.data.local.AuthPreferences
import com.kashnode.app.data.local.AuthSession
import com.kashnode.app.data.local.DeviceRole
class SessionRepository(context:Context,private val auth:AuthPreferences,private val api:KashNodeApi){
 private val id=Settings.Secure.getString(context.contentResolver,Settings.Secure.ANDROID_ID)?: "android-device-unknown"
 suspend fun login(email:String,password:String)=save(api.login(LoginRequest(email,password,id)))
 suspend fun pair(token:String)=save(api.claim(PairRequest(token,id)))
 private suspend fun save(r:AuthResponse){val t=r.auth_token?:error(r.message?: "Authentication failed.");auth.save(AuthSession(r.merchant_id,t,r.store_name?:"KashNode",r.active_plan?:"free",DeviceRole.parse(r.device_role),r.expires_at));if(DeviceRole.parse(r.device_role)==DeviceRole.ADMIN_GATEWAY){val secret=api.deviceHmacSecret().body()?.get("device_hmac_secret");if(!secret.isNullOrBlank())auth.saveDeviceHmacSecret(secret)}}
}
