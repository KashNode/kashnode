export function createCheckWallet({ pool }) {
  return async function checkWallet(req, res, next) {
    if (!pool) return res.status(503).json({ status: 'error', message: 'Billing service is unavailable.' })

    const merchantId = req.merchant?.id || req.session?.user?.merchantId
    if (!merchantId) return res.status(401).json({ status: 'error', message: 'Authenticated merchant context is required.' })

    try {
      const result = await pool.query(
        `SELECT id, wallet_balance, available_voice_minutes
         FROM public.merchants WHERE id = $1 LIMIT 1`,
        [merchantId],
      )
      const merchant = result.rows[0]
      if (!merchant) return res.status(404).json({ status: 'error', message: 'Merchant workspace was not found.' })

      const walletBalance = Number(merchant.wallet_balance ?? 0)
      const availableVoiceMinutes = Number(merchant.available_voice_minutes ?? 0)
      const hasWalletCredit = Number.isFinite(walletBalance) && walletBalance > 0
      const hasPrepaidVoiceMinutes = Number.isFinite(availableVoiceMinutes) && availableVoiceMinutes > 0
      req.merchant = { ...req.merchant, ...merchant, wallet_balance: walletBalance, available_voice_minutes: availableVoiceMinutes }

      if (!hasWalletCredit && !hasPrepaidVoiceMinutes) {
        return res.status(402).json({
          status: 'error',
          code: 'INSUFFICIENT_VOICE_CREDIT',
          message: 'A positive wallet balance or available voice minutes are required.',
        })
      }
      return next()
    } catch (error) {
      return next(error)
    }
  }
}

// Backward-compatible export name; this now checks wallet/voice credit only.
export const createCheckLimits = createCheckWallet
