package com.kashnode.mfsgateway

import java.math.BigDecimal
import java.util.Locale

data class ParsedMfsPayment(
    val gateway: String,
    val trxId: String,
    val amount: String,
    val senderPhone: String?,
    val receiverPhone: String?,
    val rawMessage: String
)

object MfsParser {
    private val trx = Regex("""\b(?:Trx\s*ID|Txn\s*ID|Transaction\s*(?:ID|No\.?|Number))\s*[:#=-]?\s*([A-Z0-9-]{5,40})\b""", RegexOption.IGNORE_CASE)
    private val amount = Regex("""\b(?:Amount|Received|Credited|Cash\s*In)\s*[:=]?\s*(?:Tk\.?|BDT)?\s*([\d,]+(?:\.\d{1,2})?)|\b(?:Tk\.?|BDT)\s*([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE)
    private val sender = Regex("""\b(?:From|Sender|Sender Number|Payer|Mobile)\s*[:=-]?\s*(\+?8801[3-9]\d{8}|01[3-9]\d{8})\b""", RegexOption.IGNORE_CASE)
    private val receiver = Regex("""\b(?:To|Receiver|Recipient|Merchant)\s*[:=-]?\s*(\+?8801[3-9]\d{8}|01[3-9]\d{8})\b""", RegexOption.IGNORE_CASE)

    fun normalizePhone(value: String?): String? {
        if (value == null) return null
        var digits = value.filter(Char::isDigit)
        if (digits.startsWith("00880")) digits = "0" + digits.drop(5)
        else if (digits.startsWith("880")) digits = "0" + digits.drop(3)
        return digits.takeIf { Regex("""^01[3-9]\d{8}$""").matches(it) }
    }

    fun parse(source: String, text: String): ParsedMfsPayment? {
        val provider = when {
            Regex("bkash", RegexOption.IGNORE_CASE).containsMatchIn(source) -> "bKash"
            Regex("nagad", RegexOption.IGNORE_CASE).containsMatchIn(source) -> "Nagad"
            Regex("rocket|dbbl|16216", RegexOption.IGNORE_CASE).containsMatchIn(source) -> "Rocket"
            else -> return null
        }
        // Require incoming-payment wording; do not treat balance/fee messages as receipts.
        if (!Regex("""received|credited|cash\s*in|payment\s*received""", RegexOption.IGNORE_CASE).containsMatchIn(text)) return null
        val trxId = trx.find(text)?.groupValues?.get(1)?.uppercase(Locale.ROOT) ?: return null
        val amountMatch = amount.find(text) ?: return null
        val amountText = amountMatch.groupValues.drop(1).firstOrNull { it.isNotBlank() } ?: return null
        val parsedAmount = runCatching { BigDecimal(amountText.replace(",", "")).setScale(2).toPlainString() }.getOrNull() ?: return null
        if (BigDecimal(parsedAmount) <= BigDecimal.ZERO) return null
        val senderPhone = normalizePhone(sender.find(text)?.groupValues?.get(1))
        val receiverPhone = normalizePhone(receiver.find(text)?.groupValues?.get(1))
        return ParsedMfsPayment(provider, trxId, parsedAmount, senderPhone, receiverPhone, text)
    }
}
