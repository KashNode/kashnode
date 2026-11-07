package com.kashnode.app.telephony
import android.content.Context
import android.os.Handler
import android.telephony.TelephonyManager
enum class BdOperator(val aliases:Set<String>,val balance:String,val data:String){
 GRAMEENPHONE(setOf("grameenphone","gp"),"*566#","*121*1*4#"),ROBI(setOf("robi"),"*222#","*8444*88#"),BANGLALINK(setOf("banglalink"),"*124#","*5000#"),AIRTEL(setOf("airtel"),"*778#","*8444*88#"),TELETALK(setOf("teletalk"),"*152#","*152#");
 companion object{fun detect(carrier:String)=entries.firstOrNull{o->o.aliases.any{carrier.lowercase().contains(it)}}}
}
class BdUssdTracker(context:Context){private val handler=Handler(context.mainLooper);fun query(manager:TelephonyManager,code:String,callback:TelephonyManager.UssdResponseCallback)=manager.sendUssdRequest(code,callback,handler)}
