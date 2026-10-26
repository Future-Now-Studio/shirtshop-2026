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

/** Calendar date (YYYY-MM-DD) in the business time zone. */
export function berlinDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d)
}

/** A date-only value (YYYY-MM-DD) as dd.mm.yyyy — no time-zone shift. */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-')
  return d && m && y ? `${d}.${m}.${y}` : day
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

// VAT is rounded once, in cents, and gross = net + VAT — the same rule in the
// dialog, order pages, documents and mails (send-order-email.mjs mirrors it).
const toCents = (n: number) => Math.round(n * 100 + 1e-9)

/** VAT on a net amount, rounded to cents. */
export function vatFrom(net: number): number {
  return Math.round(toCents(net) * VAT_RATE + 1e-9) / 100
}

export function grossFrom(net: number): number {
  return (toCents(net) + Math.round(toCents(net) * VAT_RATE + 1e-9)) / 100
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

/** Non-cancelled orders of the year whose prices are still provisional (not fully in the budget yet). */
export function budgetPending(
  orders: { status: string; createdAt: string; priceConfirmed?: boolean }[],
  year = berlinYear(),
): number {
  return orders.filter(
    (o) => o.status !== 'storniert' && o.priceConfirmed === false && berlinYear(new Date(o.createdAt)) === year,
  ).length
}

/**
 * Open a link that first has to be resolved asynchronously (signed storage
 * URL) in a new tab. The tab is opened synchronously inside the click so
 * Safari's popup blocker allows it, then pointed at the URL. Returns false
 * when the URL could not be resolved (the empty tab is closed again).
 */
export async function openInNewTab(resolve: () => Promise<string | null | undefined>): Promise<boolean> {
  const w = window.open('', '_blank')
  if (w) {
    try {
      w.document.title = 'Dokument wird geladen…'
      w.document.body.style.fontFamily = 'system-ui, sans-serif'
      w.document.body.textContent = 'Dokument wird geladen…'
    } catch {
      /* ignore */
    }
  }
  let url: string | null | undefined
  try {
    url = await resolve()
  } catch {
    url = null
  }
  if (!url) {
    w?.close()
    return false
  }
  if (w) {
    w.opener = null
    w.location.href = url
  } else {
    // Popup blocked anyway → open in the current tab instead of doing nothing.
    window.location.href = url
  }
  return true
}

/** Build a CSV (semicolon, German Excel) and download it. Cells starting with =+-@ are quoted against formula injection. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const cell = (v: string | number | null | undefined) => {
    if (typeof v === 'number') return v.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false })
    let s = v ?? ''
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
