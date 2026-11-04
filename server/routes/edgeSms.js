import { parseMfsSms } from '../parsers/mfs.js'

const MAX_SENDER_LENGTH = 50
const MAX_MESSAGE_LENGTH = 8_000

export function createEdgeSmsHandler({ pool, parser = parseMfsSms, onPersist = async () => {} }) {
  return async function ingestEdgeSms(req, res) {
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database unavailable.' })
    }

    const merchantSecret = req.get('x-merchant-secret')
    if (typeof merchantSecret !== 'string' || !merchantSecret || merchantSecret.length > 255) {
      return res.status(401).json({ success: false, error: 'Invalid merchant credentials.' })
    }

    const merchantResult = await pool.query(
      'SELECT id FROM merchants WHERE webhook_secret = $1 LIMIT 1',
      [merchantSecret],
    )
    const merchantId = merchantResult.rows[0]?.id
    if (!merchantId) {
      return res.status(401).json({ success: false, error: 'Invalid merchant credentials.' })
    }

    const { sender, message, received_at: receivedAt, sim_slot: simSlot } = req.body || {}
    if (typeof sender !== 'string' || !sender.trim() || sender.trim().length > MAX_SENDER_LENGTH) {
      return res.status(400).json({ success: false, error: 'A valid sender is required.' })
    }
    if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, error: 'A valid SMS message is required.' })
    }
    if (simSlot !== undefined && (!Number.isInteger(simSlot) || simSlot < 1 || simSlot > 8)) {
      return res.status(400).json({ success: false, error: 'sim_slot must be an integer from 1 to 8.' })
    }

    let parsedReceivedAt = null
    if (receivedAt !== undefined) {
      if (typeof receivedAt !== 'string' || !Number.isFinite(Date.parse(receivedAt))) {
        return res.status(400).json({ success: false, error: 'received_at must be a valid timestamp.' })
      }
      parsedReceivedAt = new Date(receivedAt).toISOString()
    }

    const parsed = parser(sender.trim(), message)
    const insertSql = [
      'INSERT INTO raw_sms_inbox',
      '(merchant_id, sender_number, raw_message, parsed_trxid, parsed_amount, provider, customer_phone, is_reconciled, received_at)',
      'VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, COALESCE($8::timestamptz, NOW()))',
      'RETURNING id',
    ].join(' ')
    const insertResult = await pool.query(insertSql, [
      merchantId,
      sender.trim(),
      message,
      parsed.trxId,
      parsed.amount,
      parsed.provider,
      parsed.customerPhone,
      parsedReceivedAt,
    ])

    const smsId = insertResult.rows[0]?.id
    if (!smsId) throw new Error('SMS inbox insert did not return an ID.')

    try {
      await onPersist(smsId)
    } catch (error) {
      // The SMS is already durably stored. A reconciliation failure must not
      // make the sender retry and create another inbox row.
      console.error('[KashNode] SMS reconciliation deferred:', error)
    }

    return res.status(201).json({
      success: true,
      id: String(smsId),
      parsed: {
        amount: parsed.amount,
        trxId: parsed.trxId,
        provider: parsed.provider,
        customerPhone: parsed.customerPhone,
      },
    })
  }
}
