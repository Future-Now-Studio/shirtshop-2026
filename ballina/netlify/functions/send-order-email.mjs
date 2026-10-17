// Netlify Function V2 — send an order confirmation email.
// Uses Resend (https://resend.com) so only an API key is needed (no SMTP libs).
//
// Required Netlify env vars:
//   RESEND_API_KEY        — Resend API key
//   ORDER_MAIL_FROM       — verified sender, e.g. "Ballina <bestellung@ballina.de>"
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Optional:
//   ORDER_NOTIFY_TO       — back-office inbox(es), comma separated: copy of new
//                           orders, cancellations and reclamations
//
// Body: { orderId, event?: 'created' | 'shipped' | 'cancelled' | 'reclaimed' }
// Security model (this endpoint used to be an open mail relay):
//   * the caller must send a valid Supabase session (Authorization: Bearer <jwt>);
//   * the request body only names an order id — recipient, order number, items
//     and total are loaded server-side from the database;
//   * the caller must be an admin (b2b_admins) or the account of the company
//     that owns the order; the mail only goes to that company's account e-mail(s);
//   * every interpolated value is HTML-escaped.
//
// Called best-effort by the app after an order is placed; failures never block
// the order.

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// Keep header values (subject) on one line.
const oneLine = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200)

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const KEY = process.env.RESEND_API_KEY
  const FROM = process.env.ORDER_MAIL_FROM
  const URL_ = process.env.SUPABASE_URL
  const ANON = process.env.SUPABASE_ANON_KEY
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!KEY || !FROM) return json(500, { error: 'RESEND_API_KEY / ORDER_MAIL_FROM missing' })
  if (!URL_ || !ANON || !SERVICE) return json(500, { error: 'Supabase env vars missing' })

  // 1) Who is calling?
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Not authenticated' })
  const meRes = await fetch(`${URL_}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  })
  if (!meRes.ok) return json(401, { error: 'Invalid session' })
  const me = await meRes.json()
  if (!me?.id) return json(401, { error: 'Invalid session' })

  // 2) Input: order id (+ optional event); recipients are never accepted.
  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const orderId = body?.orderId
  if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
    return json(400, { error: 'orderId erforderlich' })
  }
  // Which notification: new order (default), shipped (admin only), cancelled.
  const event = ['created', 'shipped', 'cancelled', 'reclaimed'].includes(body?.event) ? body.event : 'created'

  const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` }
  const get = async (path) => {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: svc })
    return r.ok ? r.json() : null
  }

  // 3) Load the order server-side (service_role → bypasses RLS).
  const orders = await get(
    `b2b_orders?id=eq.${orderId}&select=id,company_id,order_number,status,total,shipping,price_confirmed,reclamation,` +
      'tracking_carrier,tracking_number,tracking_url,b2b_companies(name),' +
      'b2b_order_items(product_name,color,size,quantity,unit_price)',
  )
  const order = Array.isArray(orders) ? orders[0] : null
  if (!order) return json(404, { error: 'Bestellung nicht gefunden' })

  // 4) Authorise: admin, or the account of the owning company.
  const [admins, ownProfiles] = await Promise.all([
    get(`b2b_admins?user_id=eq.${encodeURIComponent(me.id)}&select=user_id`),
    get(`b2b_profiles?user_id=eq.${encodeURIComponent(me.id)}&company_id=eq.${order.company_id}&select=user_id`),
  ])
  const isAdmin = Array.isArray(admins) && admins.length > 0
  const isOwner = Array.isArray(ownProfiles) && ownProfiles.length > 0
  if (!isAdmin && !isOwner) return json(403, { error: 'Forbidden' })
  // The event must match the order's real state (no fake "shipped" mails).
  if (event === 'shipped' && (!isAdmin || order.status !== 'versendet')) return json(409, { error: 'Bestellung ist nicht versendet' })
  if (event === 'cancelled' && order.status !== 'storniert') return json(409, { error: 'Bestellung ist nicht storniert' })
  if (event === 'reclaimed' && !order.reclamation) return json(409, { error: 'Keine Reklamation vorhanden' })

  // 5) Recipient(s): the company's account e-mail(s), never caller-supplied.
  const profiles = await get(`b2b_profiles?company_id=eq.${order.company_id}&select=email`)
  const to = [...new Set((profiles ?? []).map((p) => p.email).filter(Boolean))]
  if (!to.length) return json(422, { error: 'Keine Empfängeradresse für diese Firma hinterlegt' })

  const items = Array.isArray(order.b2b_order_items) ? order.b2b_order_items : []
  const rows = items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0">${esc(it.product_name)} · ${esc(it.color)} · ${esc(it.size)}</td>` +
        `<td align="right">${esc(Number(it.quantity) || 0)}×</td></tr>`,
    )
    .join('')
  const eur = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`
  const orderNumber = esc(order.order_number)
  const net = Number(order.total || 0) + Number(order.shipping || 0)
  const totalLine = order.price_confirmed
    ? `Warenwert ${eur(order.total)} · Versand ${Number(order.shipping) ? eur(order.shipping) : 'kostenlos'} · ` +
      `Gesamt ${eur(net * 1.19)} brutto (inkl. 19 % USt.)`
    : 'Die Preise werden von unserem Team geprüft und Ihnen bestätigt.'

  const copy = {
    created: {
      subject: `Bestellbestätigung #${order.order_number}`,
      title: 'Bestellbestätigung',
      intro: `Ihre Bestellung <b>#${orderNumber}</b> ist bei uns eingegangen.`,
    },
    shipped: {
      subject: `Ihre Bestellung #${order.order_number} ist unterwegs`,
      title: 'Ihre Bestellung wurde versendet',
      intro:
        `Ihre Bestellung <b>#${orderNumber}</b> hat unser Haus verlassen.` +
        (order.tracking_number
          ? `<br>Sendungsnummer: <b>${esc(order.tracking_carrier ?? '')} ${esc(order.tracking_number)}</b>` +
            (/^https:\/\//.test(order.tracking_url ?? '') ? ` · <a href="${esc(order.tracking_url)}">Sendung verfolgen</a>` : '')
          : ''),
    },
    cancelled: {
      subject: `Bestellung #${order.order_number} storniert`,
      title: 'Bestellung storniert',
      intro: `Ihre Bestellung <b>#${orderNumber}</b> wurde storniert.`,
    },
    reclaimed: {
      subject: `Ihre Reklamation zu Bestellung #${order.order_number}`,
      title: 'Reklamation eingegangen',
      intro: `Wir haben Ihre Reklamation zu Bestellung <b>#${orderNumber}</b> erhalten und melden uns kurzfristig.<br>„${esc(order.reclamation)}“`,
    },
  }[event]

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1c1c;max-width:560px">
      <h2 style="margin:0 0 4px">${copy.title}</h2>
      <p style="color:#6b7280;margin:0 0 16px">${copy.intro}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      ${event === 'created' ? `<p style="border-top:2px solid #111;margin-top:12px;padding-top:8px;font-weight:700">${totalLine}</p>` : ''}
      <p style="color:#6b7280;font-size:12px;margin-top:24px">Ballina · B2B Textildruck</p>
    </div>`

  const send = async (recipients, subject, bodyHtml) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: recipients, subject: oneLine(subject), html: bodyHtml }),
    })
    if (!res.ok) console.error('[send-order-email] resend failed', res.status, await res.text())
    return res.ok
  }

  const ok = await send(to, copy.subject, html)

  // Back-office notice for new orders and cancellations (ORDER_NOTIFY_TO,
  // comma separated). Best effort.
  const notify = (process.env.ORDER_NOTIFY_TO ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (notify.length && event !== 'shipped') {
    const company = esc(order.b2b_companies?.name ?? 'Kunde')
    const label = { created: 'Neue Bestellung', cancelled: 'Storno', reclaimed: 'Reklamation' }[event]
    const verb = { created: 'aufgegeben', cancelled: 'storniert', reclaimed: 'reklamiert' }[event]
    await send(
      notify,
      `${label} #${order.order_number} – ${order.b2b_companies?.name ?? ''}`,
      `<p><b>${company}</b> hat Bestellung <b>#${orderNumber}</b> ${verb}.</p>
       ${event === 'reclaimed' ? `<p>„${esc(order.reclamation)}“</p>` : ''}
       <table style="font-size:14px">${rows}</table>
       ${event === 'created' ? `<p>${order.price_confirmed ? totalLine : 'Preise noch zu bestätigen.'}</p>` : ''}`,
    )
  }

  if (!ok) return json(502, { error: 'Mailversand fehlgeschlagen' })
  return json(200, { ok: true })
}

export const config = { path: '/api/send-order-email' }
