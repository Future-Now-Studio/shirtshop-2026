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
  artworkPath?: string // storage path in the `artwork` bucket
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
  // false → prices are provisional until the back-office confirms them
  priceConfirmed?: boolean
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
  // structured order details (migration 012)
  poNumber?: string // Bestellzeichen / Kostenstelle
  deliveryAddress?: Address // undefined → company default address
  requestedDate?: string // Wunschtermin, YYYY-MM-DD
}

export interface Address {
  name?: string // recipient / department (order delivery address only)
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
  // Back office only: guide value for quotes, never applied to prices.
  discountPercent?: number
  // #10 optional yearly textile budget (information only, never blocks orders)
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
  orderId?: string // set once the quote was accepted
  inquiryId?: string // the inquiry this quote answers (migration 012/013)
  withdrawnAt?: string // withdrawn by the back office (status is then 'abgelaufen')
}

export const INQUIRY_STATUS_LABELS: Record<Inquiry['status'], string> = {
  neu: 'Eingegangen',
  in_bearbeitung: 'In Bearbeitung',
  angebot_gesendet: 'Angebot erstellt',
  abgeschlossen: 'Abgeschlossen',
}

export interface Inquiry {
  id: string
  productType: string
  quantity: number
  deadline?: string
  message?: string
  artworkName?: string
  artworkPath?: string
  status: 'neu' | 'in_bearbeitung' | 'angebot_gesendet' | 'abgeschlossen'
  createdAt: string
}

// --- Admin / back-office views ---------------------------------------------
export type ReclamationStatus = 'offen' | 'in_bearbeitung' | 'erledigt'

export const RECLAMATION_STATUS_LABELS: Record<ReclamationStatus, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
}

export interface AdminOrder extends Order {
  companyId: string
  companyName: string
  // Reclamation workflow (migration 013).
  reclamationStatus?: ReclamationStatus
  reclamationResolvedAt?: string
}

/** Lightweight row for the back-office order list (no nested items/events). */
export type AdminOrderListItem = Omit<AdminOrder, 'items' | 'statusHistory'> & { itemCount: number }

/** One page of a "Mehr laden" list. */
export interface Page<T> {
  rows: T[]
  /** Total matching rows (if known). */
  total?: number
  hasMore: boolean
}

export interface AdminQuote extends Quote {
  companyId: string
  companyName: string
}

/** Lightweight row for the back-office quote list (items only counted). */
export type AdminQuoteListItem = Omit<AdminQuote, 'items'> & { itemCount: number }

export interface AdminInquiry extends Inquiry {
  id: string
  companyId: string
  companyName: string
  contactPerson: string
  email: string
  phone?: string
}

/** Admin-only internal note on an order or a company (never shown to customers). */
export interface InternalNote {
  id: string
  kind: 'notiz' | 'reklamation'
  body: string
  authorEmail?: string
  createdAt: string
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  /** Resolved login e-mail of the actor (admin or customer), if known. */
  actorEmail?: string
  companyName?: string
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
  artworkFile?: File // picked in the order dialog, uploaded on submit
  artworkPath?: string // storage path in the `artwork` bucket
}
