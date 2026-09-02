// Shared domain types for the Ballina B2B portal

export type OrderStatus =
  | 'offen'
  | 'in_bearbeitung'
  | 'versendet'
  | 'abgeschlossen'
  | 'storniert'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  versendet: 'Versendet',
  abgeschlossen: 'Abgeschlossen',
  storniert: 'Storniert',
}

// Ordered pipeline used for the tracking timeline (excludes the terminal "storniert").
export const ORDER_FLOW: OrderStatus[] = [
  'offen',
  'in_bearbeitung',
  'versendet',
  'abgeschlossen',
]

export interface PriceTier {
  minQty: number
  unitPrice: number
}

export interface Product {
  id: string
  sku: string
  name: string
  description: string
  imageUrl: string
  basePrice: number
  category: string
  sizes: string[]
  colors: string[]
  active: boolean
  minOrderQty?: number // #10 MOQ
  priceTiers?: PriceTier[] // #10 Staffelpreise (list prices, before company discount)
}

export interface OrderItem {
  id: string
  productId: string
  productName: string
  imageUrl: string
  color: string
  size: string
  quantity: number
  unitPrice: number
  printPosition?: string // #12
  artworkName?: string // #12
}

export interface StatusEvent {
  status: OrderStatus
  at: string
  note?: string
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  total: number
  shipping?: number
  note?: string
  createdAt: string
  items: OrderItem[]
  // #7 tracking
  statusHistory?: StatusEvent[]
  trackingCarrier?: string
  trackingNumber?: string
  trackingUrl?: string
  // #15 reclamation
  reclamation?: string
  // attached invoice PDF (admin upload)
  invoiceName?: string
  invoiceDataUrl?: string
}

export interface Address {
  line1: string
  zip: string
  city: string
  country?: string
}

export interface Company {
  id: string
  company: string
  contactPerson: string
  email: string
  phone?: string
  customerNumber?: string
  vatId?: string
  billingAddress?: Address
  deliveryAddress?: Address
  paymentTerms?: string
  // #3 company conditions
  discountPercent?: number
  // #10 optional yearly textile budget
  annualBudget?: number
}

export type QuoteStatus = 'offen' | 'angenommen' | 'abgelehnt' | 'abgelaufen'

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  offen: 'Offen',
  angenommen: 'Angenommen',
  abgelehnt: 'Abgelehnt',
  abgelaufen: 'Abgelaufen',
}

// #4 a quote the shop sent in response to a bulk inquiry
export interface Quote {
  id: string
  quoteNumber: string
  title: string
  createdAt: string
  validUntil: string
  status: QuoteStatus
  total: number
  note?: string
  items: OrderItem[]
}

export interface Inquiry {
  id: string
  productType: string
  quantity: number
  deadline?: string
  message?: string
  status: 'neu' | 'in_bearbeitung' | 'angebot_gesendet' | 'abgeschlossen'
  createdAt: string
}

// --- Admin / back-office views ---------------------------------------------
export interface AdminOrder extends Order {
  companyId: string
  companyName: string
}

export interface AdminQuote extends Quote {
  companyId: string
  companyName: string
}

export interface AdminInquiry extends Inquiry {
  id: string
  companyId: string
  companyName: string
  contactPerson: string
  email: string
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  action: string
  entity: string
  detail: string
}

// A line in the working cart before an order is placed
export interface CartLine {
  productId: string
  productName: string
  imageUrl: string
  color: string
  size: string
  quantity: number
  unitPrice: number
  printPosition?: string // #12
  artworkName?: string // #12
}
