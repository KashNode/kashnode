package com.kashnode.app.sms
data class MfsSmsResult(val provider:String?,val trxId:String?,val amount:Double?,val senderPhone:String?)
object MfsRegexParser {
 private val trx=Regex("""(?:Trx\s*ID|Txn\s*ID|Transaction\s*ID)\s*[:#-]?\s*([A-Z0-9-]{5,40})""",RegexOption.IGNORE_CASE)
 private val amount=Regex("""(?:Tk\.?|BDT)\s*([0-9][0-9,]*(?:\.\d{1,2})?)""",RegexOption.IGNORE_CASE)
 private val phone=Regex("""(?:from|sender|sent\s+by)\s*:?\s*((?:\+?88\s*)?01[3-9](?:[\s-]?\d){8})""",RegexOption.IGNORE_CASE)
 fun parse(sender:String?,message:String?):MfsSmsResult {
  if(message.isNullOrBlank()) return MfsSmsResult(null,null,null,null)
  val gateway=when { sender?.contains("bkash",true)==true||sender=="16247"->"bKash";sender?.contains("nagad",true)==true||sender=="16167"->"Nagad";sender?.contains("rocket",true)==true||sender=="16216"->"Rocket";else->null }
  val id=trx.find(message)?.groupValues?.get(1)?.uppercase()
  val value=amount.find(message)?.groupValues?.get(1)?.replace(",","")?.toDoubleOrNull()
  val raw=phone.find(message)?.groupValues?.get(1)
  val normalized=raw?.filter{it.isDigit()}?.takeLast(11)?.takeIf{it.matches(Regex("01[3-9]\\d{8}"))}
  return MfsSmsResult(gateway,id,value,normalized)
 }
}
