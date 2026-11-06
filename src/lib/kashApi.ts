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

export type MerchantPackage = { package: 'free' | 'basic' | 'standard' | 'premium'; ratePerMinute: number; walletBalance: number; availableVoiceMinutes: number; currency: 'BDT' }

export type MerchantCourierOrder = { orderId: string; courier: string; trackingCode: string; status: string; deliveryCharge: number | null; createdAt: string }

export type MerchantOrder = {
  id: string
  platform_order_id: string
  order_number: string | null
  customer_name: string | null
  customer_phone: string | null
  total_amount: string | number
  payment_status: string
  delivery_status: string
  payment_method: string | null
  financial_status: string | null
  fulfillment_status: string | null
  currency: string | null
  shipping_address: string | null
  line_items: Array<{ id?: string | null; title?: string | null; sku?: string | null; quantity?: number; price?: string | number }>
  created_at: string
}

export type ShopifySyncResult = {
  status: 'success'
  synced: number
  updated: number
  fetched: number
  orders: MerchantOrder[]
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

export function getMerchantPackage() {
  return apiRequest<MerchantPackage>('/api/merchant/package')
}

export function getSimStatus() {
  return apiRequest<{ source: 'database'; sim: SimStatus | null }>('/api/merchant/sim')
}


export function getMerchantOrders() {
  return apiRequest<{ source: 'database'; orders: MerchantOrder[] }>('/api/merchant/orders')
}

export function syncShopifyOrders() {
  return apiWrite<ShopifySyncResult>('/api/merchant/integrations/shopify/sync', 'POST', {})
}

export function getCourierOrders() {
  return apiRequest<{ source: 'database'; courierOrders: MerchantCourierOrder[] }>('/api/merchant/courier-orders')
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
