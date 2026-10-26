import type { Address, Company, Order, Quote } from './types'
import { formatDate, formatEUR, grossFrom, shippingFor, VAT_RATE, vatFrom } from './utils'
import { COMPANY, COMPANY_LINE } from './legal'

// Everything interpolated into the document HTML is escaped — product names,
// titles and notes can contain user input.
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const addressHtml = (a: Address) =>
  [a.name, a.line1, `${a.zip} ${a.city}`, a.country].filter(Boolean).map(esc).join('<br>')

const qty = (n: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n)

// Lieferschein (back office, order detail) — a clean, printable HTML document
// that opens the browser print dialog (→ "Als PDF speichern"). No prices: it
// travels with the goods. Invoices come from the accounting system and are
// attached to the order as PDF, so there is no browser-generated invoice.
export function openDeliveryNote(order: Order, company: Company): void {
  const docNo = `LS-${order.orderNumber}`
  const date = new Intl.DateTimeFormat('de-DE').format(new Date())
  // Order delivery address → company delivery address → billing address
  // (the customer's standard address, see "Mein Konto").
  const shipTo = order.deliveryAddress ?? company.deliveryAddress ?? company.billingAddress
  const rows = order.items
    .map((it) => {
      const sub = [it.color, it.size ? `Größe ${it.size}` : '', it.printPosition ? `Druck: ${it.printPosition}` : '']
        .filter(Boolean)
        .map(esc)
        .join(' · ')
      return `<tr>
        <td>${esc(it.productName)}${sub ? `<div class="sub">${sub}</div>` : ''}</td>
        <td class="r">${qty(it.quantity)}</td>
      </tr>`
    })
    .join('')

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
  <title>${esc(docNo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1c1c1c; margin: 0; padding: 40px; font-size: 13px; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
    .brand { font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
    .brand span { color: #d61f69; }
    .muted { color: #6b7280; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { text-align: right; }
    .addr { display: flex; gap: 48px; margin: 24px 0 32px; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.items th { text-align: left; border-bottom: 2px solid #111; padding: 8px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    table.items td { padding: 10px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; }
    .sub { color: #6b7280; font-size: 11px; margin-top: 2px; }
    .pay { margin-top: 28px; color: #374151; }
    footer { margin-top: 48px; border-top: 1px solid #e5e7eb; padding-top: 12px; color: #9ca3af; font-size: 11px; }
    @media print { body { padding: 0; } }
  </style></head><body onload="window.print()">
    <div class="top">
      <div>
        <div class="brand">Ballina<span>.</span></div>
        <div class="muted">B2B Textildruck</div>
      </div>
      <div class="meta">
        <h1>Lieferschein</h1>
        <div class="muted">${esc(docNo)}</div>
        <div class="muted">Datum: ${date}</div>
        <div class="muted">Auftrag: #${esc(order.orderNumber)} vom ${formatDate(order.createdAt)}</div>
        ${order.poNumber ? `<div class="muted">Ihr Zeichen: ${esc(order.poNumber)}</div>` : ''}
      </div>
    </div>
    <div class="addr">
      <div>
        <div class="muted">Lieferanschrift</div>
        <strong>${esc(company.company)}</strong>
        ${shipTo ? `<br>${addressHtml(shipTo)}` : ''}
      </div>
      <div>
        <div class="muted">Kunde</div>
        Kd-Nr. ${esc(company.customerNumber ?? '—')}
        ${company.contactPerson ? `<br>${esc(company.contactPerson)}` : ''}
        ${order.trackingNumber ? `<div class="muted" style="margin-top:12px">Sendung: ${esc([order.trackingCarrier, order.trackingNumber].filter(Boolean).join(' '))}</div>` : ''}
      </div>
    </div>
    <table class="items">
      <thead><tr><th>Artikel</th><th class="r">Menge</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="pay">Bitte prüfen Sie die Ware bei Erhalt auf Vollständigkeit und Unversehrtheit.</p>
    <footer>${COMPANY_LINE ? `${esc(COMPANY_LINE)}<br>` : ''}${esc(COMPANY.brand)} B2B-Portal · Dieses Dokument wurde automatisch erzeugt.</footer>
  </body></html>`
  writeDoc(html)
}

// #7 Angebots-PDF
export function openQuoteDocument(quote: Quote, companyName: string): void {
  // Shipping follows the same rule as every order (DB trigger, see 008), so
  // the accepted order costs exactly what this document shows.
  const net = quote.total
  const shipping = shippingFor(net)
  const vat = vatFrom(net + shipping)
  const gross = grossFrom(net + shipping)
  const validUntil = quote.validUntil ? new Intl.DateTimeFormat('de-DE').format(new Date(quote.validUntil)) : '—'
  const itemRows = quote.items
    .map(
      (it) => `<tr>
        <td>${esc(it.productName)}<div class="sub">${esc(it.color)}${it.size ? ' · Größe ' + esc(it.size) : ''}</div></td>
        <td class="r">${it.quantity}</td>
        <td class="r">${formatEUR(it.unitPrice)}</td>
        <td class="r">${formatEUR(it.unitPrice * it.quantity)}</td>
      </tr>`,
    )
    .join('')
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(quote.quoteNumber)}</title>
  <style>
    *{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1c1c;margin:0;padding:40px;font-size:13px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
    .brand{font-size:22px;font-weight:700;letter-spacing:-.02em}.brand span{color:#d61f69}
    .muted{color:#6b7280}h1{font-size:20px;margin:0 0 4px}.meta{text-align:right}.addr{margin:24px 0 32px}
    table.items{width:100%;border-collapse:collapse;margin-top:8px}
    table.items th{text-align:left;border-bottom:2px solid #111;padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
    table.items td{padding:10px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top}
    .r{text-align:right;white-space:nowrap}.sub{color:#6b7280;font-size:11px;margin-top:2px}
    table.totals{margin-left:auto;margin-top:18px;border-collapse:collapse;min-width:260px}
    table.totals td{padding:5px 6px}table.totals tr.grand td{border-top:2px solid #111;font-weight:700;font-size:15px}
    .pay{margin-top:28px;color:#374151}footer{margin-top:48px;border-top:1px solid #e5e7eb;padding-top:12px;color:#9ca3af;font-size:11px}
    @media print{body{padding:0}}
  </style></head><body onload="window.print()">
    <div class="top">
      <div><div class="brand">Ballina<span>.</span></div><div class="muted">B2B Textildruck</div></div>
      <div class="meta"><h1>Angebot</h1><div class="muted">${esc(quote.quoteNumber)}</div><div class="muted">Gültig bis: ${validUntil}</div></div>
    </div>
    <div class="addr"><div class="muted">Angebot für</div><strong>${esc(companyName)}</strong><br>${esc(quote.title)}</div>
    <table class="items"><thead><tr><th>Artikel</th><th class="r">Menge</th><th class="r">Einzelpreis</th><th class="r">Summe</th></tr></thead><tbody>${itemRows}</tbody></table>
    <table class="totals">
      <tr><td>Zwischensumme (netto)</td><td class="r">${formatEUR(net)}</td></tr>
      <tr><td>Versand (netto)</td><td class="r">${shipping ? formatEUR(shipping) : 'kostenlos'}</td></tr>
      <tr><td>zzgl. ${Math.round(VAT_RATE * 100)} % USt.</td><td class="r">${formatEUR(vat)}</td></tr>
      <tr class="grand"><td>Gesamt (brutto)</td><td class="r">${formatEUR(gross)}</td></tr>
    </table>
    ${quote.note ? `<p class="pay" style="white-space:pre-line">${esc(quote.note)}</p>` : ''}
    <p class="pay">Annahme im ${esc(COMPANY.brand)} B2B-Portal unter „Angebote“ bis zum Ablauf der Gültigkeit.</p>
    <footer>${COMPANY_LINE ? `${esc(COMPANY_LINE)}<br>` : ''}${esc(COMPANY.brand)} B2B-Portal · Freibleibendes Angebot · erstellt am ${new Intl.DateTimeFormat('de-DE').format(new Date())}</footer>
  </body></html>`
  writeDoc(html)
}

function writeDoc(html: string): void {
  const w = window.open('', '_blank', 'width=820,height=1000')
  if (!w) {
    alert('Bitte Pop-ups für diese Seite erlauben, um das Dokument zu öffnen.')
    return
  }
  w.document.write(html)
  w.document.close()
}
