// Netlify Function V2 — send an order confirmation email.
// Uses Resend (https://resend.com) so only an API key is needed (no SMTP libs).
//
// Required Netlify env vars:
//   RESEND_API_KEY        — Resend API key
//   ORDER_MAIL_FROM       — verified sender, e.g. "Ballina <bestellung@ballina.de>"
//
// Called best-effort by the app after an order is placed; failures never block
// the order.

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const KEY = process.env.RESEND_API_KEY
  const FROM = process.env.ORDER_MAIL_FROM
  if (!KEY || !FROM) return json(500, { error: 'RESEND_API_KEY / ORDER_MAIL_FROM missing' })

  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const { to, orderNumber, total, items = [] } = body || {}
  if (!to || !orderNumber) return json(400, { error: 'to und orderNumber erforderlich' })

  const rows = items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0">${it.productName} · ${it.color} · ${it.size}</td>` +
        `<td align="right">${it.quantity}×</td></tr>`,
    )
    .join('')

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1c1c;max-width:560px">
      <h2 style="margin:0 0 4px">Bestellbestätigung</h2>
      <p style="color:#6b7280;margin:0 0 16px">Ihre Bestellung <b>#${orderNumber}</b> ist bei uns eingegangen.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      <p style="border-top:2px solid #111;margin-top:12px;padding-top:8px;font-weight:700">
        Gesamt (netto): ${Number(total || 0).toFixed(2)} €
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">Ballina · B2B Textildruck</p>
    </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject: `Bestellbestätigung #${orderNumber}`, html }),
  })
  if (!res.ok) return json(502, { error: await res.text() })
  return json(200, { ok: true })
}

export const config = { path: '/api/send-order-email' }
