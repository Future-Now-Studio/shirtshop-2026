import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
export function formatEUR(value: number): string {
  return eur.format(value)
}

/** Neutral placeholder for line items without a product image (e.g. manual orders). */
export const ITEM_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23e7e0e5'/%3E%3C/svg%3E"

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

/** #3 Company conditions — apply the customer's hinterlegten Rabatt to a list price. */
export function netPrice(basePrice: number, discountPercent = 0): number {
  const net = basePrice * (1 - discountPercent / 100)
  return Math.round(net * 100) / 100
}

/** Calendar date (YYYY-MM-DD) in the business time zone. */
function berlinDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d)
}

/**
 * A quote can be accepted while it is 'offen' and valid_until (inclusive, in
 * Europe/Berlin) has not passed — mirrors public.b2b_quote_valid() in the DB.
 */
export function isQuoteAcceptable(q: { status: string; validUntil?: string | null }): boolean {
  if (q.status !== 'offen') return false
  if (!q.validUntil) return true
  return berlinDate(new Date(q.validUntil)) >= berlinDate(new Date())
}

/** Whole days between an ISO date and now (positive = in the past). */
export function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

// #11 Shipping + VAT
export const VAT_RATE = 0.19
export const FREE_SHIPPING_FROM = 500
export const FLAT_SHIPPING = 6.9

/** Net shipping cost for a net subtotal (free above the threshold). */
export function shippingFor(netSubtotal: number): number {
  return netSubtotal >= FREE_SHIPPING_FROM || netSubtotal === 0 ? 0 : FLAT_SHIPPING
}

export function grossFrom(net: number): number {
  return Math.round(net * (1 + VAT_RATE) * 100) / 100
}

// #10 Staffelpreise — resolve the list unit price for a quantity, then apply the
// company discount. Falls back to the product base price when no tier matches.
import type { CartLine, Product } from './types'
export function tierListPrice(product: Product, qty: number): number {
  const tiers = product.priceTiers ?? []
  const match = tiers
    .filter((t) => qty >= t.minQty)
    .sort((a, b) => b.minQty - a.minQty)[0]
  return match ? match.unitPrice : product.basePrice
}
export function tierNetPrice(product: Product, qty: number, discountPercent = 0): number {
  return netPrice(tierListPrice(product, qty), discountPercent)
}

/**
 * Re-resolve a cart line's unit price against the current catalogue + company
 * discount, so quantity changes always hit the right Staffel. Lines whose
 * product is not in the catalogue (e.g. quote items with negotiated prices)
 * keep their stored price.
 */
export function repriceLine(line: CartLine, products: Product[], discountPercent = 0): CartLine {
  const product = products.find((p) => p.id === line.productId)
  if (!product) return line
  return { ...line, unitPrice: tierNetPrice(product, line.quantity, discountPercent) }
}

/** Allowed order status transitions — mirrors 010_order_status_rules.sql. */
export const NEXT_STATUS: Record<string, string[]> = {
  offen: ['in_bearbeitung', 'versendet', 'storniert'],
  in_bearbeitung: ['offen', 'versendet', 'storniert'],
  versendet: ['abgeschlossen'],
  abgeschlossen: [],
  storniert: [],
}

/** Current calendar year in the business time zone (Europe/Berlin). */
export function berlinYear(d: Date = new Date()): number {
  return Number(berlinDate(d).slice(0, 4))
}

/** [start, end) of a Berlin calendar year as ISO instants (1 Jan is always CET, UTC+1). */
export function berlinYearRange(year = berlinYear()): { from: string; to: string } {
  return {
    from: new Date(`${year}-01-01T00:00:00+01:00`).toISOString(),
    to: new Date(`${year + 1}-01-01T00:00:00+01:00`).toISOString(),
  }
}

/**
 * Budget usage: sum of the net order totals (goods, excl. shipping/VAT) of all
 * non-cancelled orders placed in the given Berlin calendar year.
 */
export function budgetSpent(
  orders: { status: string; total: number; createdAt: string }[],
  year = berlinYear(),
): number {
  const sum = orders
    .filter((o) => o.status !== 'storniert' && berlinYear(new Date(o.createdAt)) === year)
    .reduce((s, o) => s + o.total, 0)
  return Math.round(sum * 100) / 100
}
