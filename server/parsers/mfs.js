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
};

const genericAmountPattern = /\b(?:Tk|BDT)\s*([\d,]+(?:\.\d{1,2})?)/i;
const transactionIdPattern = /\b(?:Trx\s*ID|Txn\s*ID|Transaction\s*(?:ID|No\.?|Number))\s*[:#=-]?\s*([A-Z0-9-]+)\b/i;
const payerPhonePattern = /\b(?:from|sender(?:\s+number)?|payer(?:\s+number)?|mobile(?:\s+number)?|msisdn)\b\s*[:#=-]?\s*(\+?\d(?:[\d\s-]{6,18}\d))/i;

const providerNames = {
  bkash: 'bKash',
  nagad: 'Nagad',
  rocket: 'Rocket',
  upay: 'Upay',
};

function normalizeProvider(sender) {
  const normalized = String(sender || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (normalized.includes('bkash')) return 'bkash';
  if (normalized.includes('nagad') || normalized === '16167') return 'nagad';
  if (normalized.includes('rocket') || normalized.includes('dbbl') || normalized === '16216') return 'rocket';
  if (normalized.includes('upay') || normalized === '16268') return 'upay';
  return null;
}

function normalizeBdPhone(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const digits = String(value).replace(/\D/g, '');
  const last11 = digits.slice(-11);
  return /^01[3-9]\d{8}$/.test(last11) ? last11 : null;
}

function extractAmount(message, provider) {
  if (!provider) return null;
  for (const pattern of [...(amountPatterns[provider] || []), genericAmountPattern]) {
    const match = message.match(pattern);
    if (!match) continue;
    const amount = Number(match[1].replaceAll(',', ''));
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  return null;
}

function extractCustomerPhone(message) {
  const match = message.match(payerPhonePattern);
  return match ? normalizeBdPhone(match[1]) : null;
}

export function parseMfsSms(sender, rawMessage) {
  if (typeof rawMessage !== 'string') {
    return { provider: null, amount: null, trxId: null, customerPhone: null };
  }

  const providerKey = normalizeProvider(sender);
  return {
    provider: providerKey ? providerNames[providerKey] : null,
    amount: extractAmount(rawMessage, providerKey),
    trxId: rawMessage.match(transactionIdPattern)?.[1]?.toUpperCase() || null,
    customerPhone: extractCustomerPhone(rawMessage),
  };
}
