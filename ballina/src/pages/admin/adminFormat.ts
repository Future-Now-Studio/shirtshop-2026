// Small back-office helpers: German number input/output, PDF picking, CSV.
import { ORDER_STATUS_LABELS, QUOTE_STATUS_LABELS, RECLAMATION_STATUS_LABELS, type QuoteStatus } from '@/lib/types'
import type { OrderExportRow } from '@/lib/adminApi'
import { VAT_RATE } from '@/lib/utils'

const num2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const numAny = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

/** 29.9 → "29,90" (input prefill / CSV, no thousands separator). */
export function formatDecimal(n: number): string {
  return num2.format(n).replace(/\./g, '')
}

/** "29,90" / "29.90" / "1.234,50" → 29.9; NaN when not a number. */
export function parseDecimal(raw: string): number {
  const t = raw.trim().replace(/\s/g, '')
  if (!t) return NaN
  // German thousands dots only when a decimal comma follows ("1.234,50").
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN
}

/** 12.5 → "12,5 %". */
export function formatPercent(n: number): string {
  return `${numAny.format(n)} %`
}

/** 1200 → "1.200". */
export function formatQty(n: number): string {
  return numAny.format(n)
}

/** Today in Europe/Berlin as YYYY-MM-DD (min for date inputs). */
export function berlinToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())
}

/** YYYY-MM-DD n days from today (Berlin). */
export function berlinDatePlus(days: number): string {
  const [y, m, d] = berlinToday().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export const QUOTE_VARIANT: Record<QuoteStatus, 'info' | 'success' | 'destructive' | 'neutral'> = {
  offen: 'info',
  angenommen: 'success',
  abgelehnt: 'destructive',
  abgelaufen: 'neutral',
}

/** Quote status label; a withdrawn quote is stored as 'abgelaufen' + withdrawn_at. */
export function quoteStatusLabel(q: { status: QuoteStatus; withdrawnAt?: string }): string {
  return q.withdrawnAt ? 'Zurückgezogen' : QUOTE_STATUS_LABELS[q.status]
}

export const MAX_PDF_BYTES = 4_000_000

/**
 * Read a picked file as a PDF data URL. Rejects non-PDFs (type and %PDF magic
 * bytes) and files over 4 MB before anything is uploaded.
 */
export async function readPdfFile(file: File): Promise<{ name: string; dataUrl: string }> {
  if (file.size > MAX_PDF_BYTES) throw new Error('Die PDF-Datei ist größer als 4 MB.')
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  const isPdf = String.fromCharCode(...head) === '%PDF-'
  if (!isPdf || (file.type && file.type !== 'application/pdf')) throw new Error('Bitte eine PDF-Datei wählen.')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'))
    reader.readAsDataURL(file)
  })
  // Some browsers report an empty type; normalise the data URL to application/pdf.
  return { name: file.name, dataUrl: dataUrl.replace(/^data:[^;,]*/, 'data:application/pdf') }
}

// ---------------------------------------------------------------------------
// CSV export (German Excel: semicolon, UTF-8 BOM, CRLF)
// ---------------------------------------------------------------------------

/**
 * One CSV cell. Text that a spreadsheet would treat as a formula (= + - @,
 * tab, CR) is prefixed with ' so it is shown as text (CSV/formula injection).
 */
function cell(v: string | number | undefined | null, isNumber = false): string {
  if (v === undefined || v === null || v === '') return ''
  let s = isNumber && typeof v === 'number' ? formatDecimal(v) : String(v)
  if (!isNumber && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s
}

// Business time zone, so the date does not depend on the admin's computer.
const dateDE = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date(iso))
    : ''

/** Build the order export: one row per order, or per position when items are included. */
export function ordersCsv(rows: OrderExportRow[], withItems: boolean): string {
  const head = [
    'Bestellnr.', 'Datum', 'Kunde', 'Kd-Nr.', 'Status', 'Preise bestätigt', 'Bestellzeichen', 'Wunschtermin', 'Lieferadresse',
    ...(withItems
      ? ['Artikel', 'Farbe', 'Größe', 'Druck', 'Menge', 'Einzelpreis netto', 'Positionssumme netto']
      : ['Positionen', 'Warenwert netto', 'Versand netto', 'Summe netto', 'Summe brutto']),
    'Versanddienst', 'Sendungsnummer', 'Reklamation',
  ]
  const lines = rows.map(({ order: o, item }) => {
    const addr = o.deliveryAddress
      ? [o.deliveryAddress.name, o.deliveryAddress.line1, `${o.deliveryAddress.zip} ${o.deliveryAddress.city}`.trim(), o.deliveryAddress.country]
          .filter(Boolean)
          .join(', ')
      : ''
    const shipping = o.shipping ?? 0
    const cols = [
      cell(o.orderNumber), cell(dateDE(o.createdAt)), cell(o.companyName), cell(o.customerNumber),
      cell(ORDER_STATUS_LABELS[o.status] ?? o.status), cell(o.priceConfirmed === false ? 'nein' : 'ja'),
      cell(o.poNumber), cell(o.requestedDate ? dateDE(o.requestedDate) : ''), cell(addr),
      ...(withItems
        ? item
          ? [cell(item.productName), cell(item.color), cell(item.size), cell(item.printPosition), cell(String(item.quantity)),
             cell(item.unitPrice, true), cell(item.unitPrice * item.quantity, true)]
          : ['', '', '', '', '', '', '']
        : [cell(String(o.itemCount)), cell(o.total, true), cell(shipping, true), cell(o.total + shipping, true),
           cell(Math.round((o.total + shipping) * (1 + VAT_RATE) * 100) / 100, true)]),
      cell(o.trackingCarrier), cell(o.trackingNumber),
      cell(o.reclamation ? `${RECLAMATION_STATUS_LABELS[o.reclamationStatus ?? 'offen']}: ${o.reclamation}` : ''),
    ]
    return cols.join(';')
  })
  return '﻿' + [head.map((h) => cell(h)).join(';'), ...lines].join('\r\n') + '\r\n'
}

/** Offer a text file for download. */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
