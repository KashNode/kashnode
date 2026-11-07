package com.kashnode.app.data.local
import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
enum class DeviceRole { MERCHANT,ADMIN_GATEWAY; companion object { fun parse(s:String?)=entries.firstOrNull{it.name.equals(s,true)}?:MERCHANT } }
data class AuthSession(val merchantId:String?,val authToken:String,val storeName:String,val activePlan:String,val deviceRole:DeviceRole,val expiresAt:String?)
class AuthPreferences(context:Context){
 private val prefs=EncryptedSharedPreferences.create(context,"kashnode_auth",MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
 fun save(s:AuthSession)=prefs.edit().putString("merchant_id",s.merchantId).putString("auth_token",s.authToken).putString("store_name",s.storeName).putString("active_plan",s.activePlan).putString("device_role",s.deviceRole.name.lowercase()).putString("expires_at",s.expiresAt).apply()
 fun session():AuthSession?{val t=prefs.getString("auth_token",null)?.takeIf{it.isNotBlank()}?:return null;return AuthSession(prefs.getString("merchant_id",null),t,prefs.getString("store_name","KashNode")?:"KashNode",prefs.getString("active_plan","free")?:"free",DeviceRole.parse(prefs.getString("device_role","merchant")),prefs.getString("expires_at",null))}
 fun deviceHmacSecret():String?=prefs.getString("device_hmac_secret",null)
 fun saveDeviceHmacSecret(secret:String){require(secret.length>=32);prefs.edit().putString("device_hmac_secret",secret).apply()}
 fun autoDialEnabled()=prefs.getBoolean("auto_dial_mode",true)
 fun setAutoDialEnabled(enabled:Boolean){prefs.edit().putBoolean("auto_dial_mode",enabled).apply()}
 fun primaryCallSimSlot()=prefs.getInt("primary_call_sim_slot",0)
 fun setPrimaryCallSimSlot(slot:Int){require(slot in 0..1);prefs.edit().putInt("primary_call_sim_slot",slot).apply()}
 fun clear()=prefs.edit().clear().apply()
}