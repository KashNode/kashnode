export type SimStatus = {
  deviceId: string
  balance: number
  internetDataMb: number
  dataQuotaMb: number
  signalStrength: number
  networkType: string
  online: boolean
  updatedAt: string
  source: 'device' | 'database'
}

export type CallHistoryEntry = {
  id: string
  phone: string
  occurredAt: string
  durationSeconds: number
  status: string
  summary: string
  billedAmount: number
  currency: string
  billingSource: 'wallet' | 'voice_minutes' | 'included'
  recordingUrl: string | null
}

export type OrderTrackingResult = {
  orderId: string
  courier: string
  status: string
  deliveryCharge: number | null
  note: string
  source: 'database' | 'mock' | 'live'
  checkedAt: string
}

export type SimUssdSettings = {
  autoBalance: boolean
  frequency: 'Every 6 hours' | 'Daily' | 'Manual'
  balanceCode: string
  internetCode: string
  source?: string
}

async function apiRequest<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status}).`)
  return payload as T
}

async function apiWrite<T>(path: string, method: 'PUT' | 'POST', body: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status}).`)
  return payload as T
}

export function getSimStatus() {
  return apiRequest<{ source: 'database'; sim: SimStatus | null }>('/api/merchant/sim')
}

export function getCallHistory() {
  return apiRequest<{ source: 'billing_ledger'; calls: CallHistoryEntry[] }>('/api/merchant/calls')
}

export function trackOrder(orderId: string, courier: 'steadfast' | 'redx' | 'pathao') {
  return apiRequest<OrderTrackingResult>(`/api/orders/track/${encodeURIComponent(orderId)}?courier=${courier}`)
}

export function getSimUssdSettings() {
  return apiRequest<SimUssdSettings>('/api/settings/sim-ussd')
}

export function saveSimUssdSettings(settings: SimUssdSettings) {
  return apiWrite<{ status: string; settings: SimUssdSettings }>('/api/settings/sim-ussd', 'PUT', settings)
}
