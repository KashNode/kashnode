const amountPatterns = {
  bkash: [
    /\b(?:received|credited)\b[\s\S]{0,80}?\b(?:Tk|BDT)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\bAmount\s*[:=]\s*(?:Tk|BDT)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ],
  nagad: [
    /\bAmount\s*[:=]\s*(?:Tk|BDT)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\breceived\b[\s\S]{0,80}?\b(?:Tk|BDT)\s*([\d,]+(?:\.\d{1,2})?)/i,
  ],
  rocket: [
    /\bAmount\s*[:=]\s*(?:Tk|BDT)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\b(?:received|credited|cash\s*in)\b[\s\S]{0,80}?\b(?:Tk|BDT)\s*([\d,]+(?:\.\d{1,2})?)/i,
  ],
  upay: [
    /\bAmount\s*[:=]\s*(?:Tk|BDT)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\b(?:received|credited)\b[\s\S]{0,80}?\b(?:Tk|BDT)\s*([\d,]+(?:\.\d{1,2})?)/i,
  ],
}

const genericAmountPattern = /\b(?:Tk|BDT)\s*([\d,]+(?:\.\d{1,2})?)/i
const transactionIdPattern = /\b(?:Trx\s*ID|Txn\s*ID|Transaction\s*(?:ID|No\.?|Number))\s*[:#=-]?\s*([A-Z0-9-]+)\b/i

function normalizeProvider(sender) {
  const normalized = String(sender || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
  if (normalized.includes('bkash') || normalized === '16216') return 'bkash'
  if (normalized.includes('nagad') || normalized === '16167') return 'nagad'
  if (normalized.includes('rocket') || normalized.includes('dbbl')) return 'rocket'
  if (normalized.includes('upay') || normalized === '16268') return 'upay'
  return null
}

function extractAmount(message, provider) {
  if (!provider) return null
  const patterns = [...(amountPatterns[provider] || []), genericAmountPattern]
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (!match) continue
    const amount = Number(match[1].replaceAll(',', ''))
    if (Number.isFinite(amount)) return amount
  }
  return null
}

export function parseMfsSms(sender, rawMessage) {
  if (typeof rawMessage !== 'string') return { amount: null, trxId: null }

  const provider = normalizeProvider(sender)
  const transactionId = rawMessage.match(transactionIdPattern)?.[1]?.toUpperCase() || null

  return {
    amount: extractAmount(rawMessage, provider),
    trxId: transactionId,
  }
}
