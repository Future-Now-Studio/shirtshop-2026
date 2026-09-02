import type { Company, Order, Quote } from './types'
import { formatEUR, grossFrom, VAT_RATE } from './utils'

// #6 Belegarchiv — build a clean, printable HTML document and open the browser
// print dialog (→ "Als PDF speichern"). No external PDF lib, works offline.
type DocKind = 'rechnung' | 'lieferschein'

function rows(order: Order, withPrices: boolean): string {
  return order.items
    .map((it) => {
      const line = withPrices
        ? `<td class="r">${formatEUR(it.unitPrice)}</td><td class="r">${formatEUR(it.unitPrice * it.quantity)}</td>`
        : ''
      return `<tr>
        <td>${it.productName}<div class="sub">${it.color} · Größe ${it.size}</div></td>
        <td class="r">${it.quantity}</td>
        ${line}
      </tr>`
    })
    .join('')
}

function buildHtml(kind: DocKind, order: Order, company: Company): string {
  const isInvoice = kind === 'rechnung'
  const title = isInvoice ? 'Rechnung' : 'Lieferschein'
  const docNo = isInvoice
    ? `RE-${order.orderNumber}`
    : `LS-${order.orderNumber}`
  const net = order.total
  const vat = net * VAT_RATE
  const gross = net + vat
  const date = new Intl.DateTimeFormat('de-DE').format(new Date())

  const totals = isInvoice
    ? `<table class="totals">
        <tr><td>Zwischensumme (netto)</td><td class="r">${formatEUR(net)}</td></tr>
        <tr><td>zzgl. 19 % USt.</td><td class="r">${formatEUR(vat)}</td></tr>
        <tr class="grand"><td>Gesamtbetrag</td><td class="r">${formatEUR(gross)}</td></tr>
      </table>
      <p class="pay">Zahlbar innerhalb von 14 Tagen ohne Abzug. Vielen Dank für Ihren Auftrag.</p>`
    : `<p class="pay">Bitte prüfen Sie die Ware bei Erhalt auf Vollständigkeit und Unversehrtheit.</p>`

  const priceHead = isInvoice ? '<th class="r">Einzelpreis</th><th class="r">Summe</th>' : ''

  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
  <title>${docNo}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1c1c1c; margin: 0; padding: 40px; font-size: 13px; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
    .brand { font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
    .brand span { color: #d61f69; }
    .muted { color: #6b7280; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { text-align: right; }
    .addr { margin: 24px 0 32px; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.items th { text-align: left; border-bottom: 2px solid #111; padding: 8px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    table.items td { padding: 10px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; }
    .sub { color: #6b7280; font-size: 11px; margin-top: 2px; }
    table.totals { margin-left: auto; margin-top: 18px; border-collapse: collapse; min-width: 260px; }
    table.totals td { padding: 5px 6px; }
    table.totals tr.grand td { border-top: 2px solid #111; font-weight: 700; font-size: 15px; }
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
        <h1>${title}</h1>
        <div class="muted">${docNo}</div>
        <div class="muted">Datum: ${date}</div>
        <div class="muted">Auftrag: #${order.orderNumber}</div>
      </div>
    </div>
    <div class="addr">
      <div class="muted">Rechnungsempfänger</div>
      <strong>${company.company}</strong><br>
      ${company.contactPerson ?? ''}<br>
      Kd-Nr. ${company.customerNumber ?? '—'}
    </div>
    <table class="items">
      <thead><tr><th>Artikel</th><th class="r">Menge</th>${priceHead}</tr></thead>
      <tbody>${rows(order, isInvoice)}</tbody>
    </table>
    ${totals}
    <footer>Ballina B2B Portal · Dieses Dokument wurde automatisch erzeugt.</footer>
  </body></html>`
}

export function openDocument(kind: DocKind, order: Order, company: Company): void {
  writeDoc(buildHtml(kind, order, company))
}

// #7 Angebots-PDF
export function openQuoteDocument(quote: Quote, companyName: string): void {
  const net = quote.total
  const vat = Math.round(net * VAT_RATE * 100) / 100
  const gross = grossFrom(net)
  const validUntil = new Intl.DateTimeFormat('de-DE').format(new Date(quote.validUntil))
  const itemRows = quote.items
    .map(
      (it) => `<tr>
        <td>${it.productName}<div class="sub">${it.color}${it.size ? ' · Größe ' + it.size : ''}</div></td>
        <td class="r">${it.quantity}</td>
        <td class="r">${formatEUR(it.unitPrice)}</td>
        <td class="r">${formatEUR(it.unitPrice * it.quantity)}</td>
      </tr>`,
    )
    .join('')
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${quote.quoteNumber}</title>
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
      <div class="meta"><h1>Angebot</h1><div class="muted">${quote.quoteNumber}</div><div class="muted">Gültig bis: ${validUntil}</div></div>
    </div>
    <div class="addr"><div class="muted">Angebot für</div><strong>${companyName}</strong><br>${quote.title}</div>
    <table class="items"><thead><tr><th>Artikel</th><th class="r">Menge</th><th class="r">Einzelpreis</th><th class="r">Summe</th></tr></thead><tbody>${itemRows}</tbody></table>
    <table class="totals">
      <tr><td>Zwischensumme (netto)</td><td class="r">${formatEUR(net)}</td></tr>
      <tr><td>zzgl. 19 % USt.</td><td class="r">${formatEUR(vat)}</td></tr>
      <tr class="grand"><td>Gesamt (brutto)</td><td class="r">${formatEUR(gross)}</td></tr>
    </table>
    ${quote.note ? `<p class="pay">${quote.note}</p>` : ''}
    <footer>Ballina B2B Portal · Freibleibendes Angebot · erstellt am ${new Intl.DateTimeFormat('de-DE').format(new Date())}</footer>
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
