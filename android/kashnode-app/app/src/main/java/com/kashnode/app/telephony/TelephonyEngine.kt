package com.kashnode.app.telephony
import android.content.Context
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
data class SimSlot(val subscriptionId:Int,val slotIndex:Int,val carrierName:String)
class TelephonyEngine(private val context:Context){
 fun activeSims():List<SimSlot>{val m=context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager;return runCatching{m.activeSubscriptionInfoList.orEmpty().map{SimSlot(it.subscriptionId,it.simSlotIndex,it.carrierName?.toString()?: "SIM")}}.getOrDefault(emptyList())}
 fun manager(id:Int)=(context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager).createForSubscriptionId(id)
}
