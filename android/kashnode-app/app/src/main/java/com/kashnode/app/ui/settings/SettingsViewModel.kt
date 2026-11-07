package com.kashnode.app.ui.settings

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.telephony.SubscriptionManager
import androidx.core.content.ContextCompat
import com.kashnode.app.data.local.AuthPreferences

data class SimOption(val slotIndex:Int,val subscriptionId:Int,val carrierName:String,val displayName:String) {
 val label:String get()="SIM ${slotIndex+1} · ${carrierName.ifBlank { "Unknown carrier" }} · ${displayName.ifBlank { "Mobile network" }}"
}

class SettingsViewModel(context:Context) {
 private val appContext=context.applicationContext
 private val auth=AuthPreferences(appContext)

 fun hasPhoneStatePermission():Boolean =
  ContextCompat.checkSelfPermission(appContext,Manifest.permission.READ_PHONE_STATE)==PackageManager.PERMISSION_GRANTED

 fun availableSims():List<SimOption> {
  if(!hasPhoneStatePermission()) return emptyList()
  return try {
   val manager=appContext.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
   manager.activeSubscriptionInfoList.orEmpty()
    .sortedBy { it.simSlotIndex }
    .map { info -> SimOption(info.simSlotIndex,info.subscriptionId,info.carrierName?.toString().orEmpty(),info.displayName?.toString().orEmpty()) }
    .filter { it.slotIndex in 0..1 }
  } catch (_:SecurityException) { emptyList() }
 }

 fun selectedCallSimSlot()=auth.primaryCallSimSlot()
 fun selectCallSimSlot(slot:Int)=auth.setPrimaryCallSimSlot(slot)
 fun smsMonitoringSelection()=auth.smsMonitoringSimSelection()
 fun selectSmsMonitoring(selection:Int)=auth.setSmsMonitoringSimSelection(selection)
 fun autoDialEnabled()=auth.autoDialEnabled()
 fun setAutoDialEnabled(enabled:Boolean)=auth.setAutoDialEnabled(enabled)
}
