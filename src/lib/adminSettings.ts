export type LlmProvider = 'openai' | 'gemini' | 'groq'

export type ProviderKeyStatus = {
  configured: boolean
  maskedSuffix: string | null
}

export type AdminSystemSettings = {
  activeLlmProvider: LlmProvider
  defaultVoiceRate: number
  apiKeys: Record<LlmProvider, ProviderKeyStatus>
  updatedAt: string | null
}

export type AdminSystemSettingsInput = {
  activeLlmProvider: LlmProvider
  defaultVoiceRate: number
  apiKeys?: Partial<Record<LlmProvider, string>>
  clearApiKeys?: LlmProvider[]
}

async function readPayload(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || fallback)
  if (!payload.settings) throw new Error('The admin settings API returned an invalid response.')
  return payload.settings as AdminSystemSettings
}

export async function getAdminSystemSettings(): Promise<AdminSystemSettings> {
  const response = await fetch('/api/admin/settings', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  return readPayload(response, 'Could not load system settings.')
}

export async function saveAdminSystemSettings(input: AdminSystemSettingsInput): Promise<AdminSystemSettings> {
  const response = await fetch('/api/admin/settings', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  })
  return readPayload(response, 'Could not save system settings.')
}
