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
