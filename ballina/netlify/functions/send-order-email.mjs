// Netlify Function V2 — portal e-mails (orders, quotes, inquiries).
// Uses Resend (https://resend.com) so only an API key is needed (no SMTP libs).
//
// Required Netlify env vars:
//   RESEND_API_KEY        — Resend API key
//   ORDER_MAIL_FROM       — verified sender, e.g. "Ballina <bestellung@ballina.de>"
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Optional:
//   ORDER_NOTIFY_TO       — back-office inbox(es), comma separated: new orders,
//                           cancellations and reclamations by customers, new
//                           inquiries. Default: the e-mails in b2b_admins.
//   PORTAL_URL            — base URL for links in mails (default: site URL)
//
// Body (one of):
//   { event: 'created' | 'shipped' | 'cancelled' | 'reclaimed' | 'prices_confirmed' | 'tracking_updated', orderId }
//   { event: 'quote_created', quoteId }
//   { event: 'inquiry_created', inquiryId }
//   { orderId } alone means 'created' (older clients).
//
// Security model (this endpoint used to be an open mail relay):
//   * the caller must send a valid Supabase session (Authorization: Bearer <jwt>);
//   * the body only names a row id — recipients, numbers, items and totals are
//     loaded server-side; recipients are never accepted from the caller;
//   * per event: who may trigger it and which state the row must be in
//     (customers: own company only, and only for fresh orders/inquiries);
//   * every event is sent at most once per row (b2b_mail_log, migration 014);
//     a repeat answers 200 { ok: true, duplicate: true } and sends nothing.
//     Exception tracking_updated: once per distinct carrier + tracking number
//     (keyed claim, migration 015), the key is built from the DB row;
//   * every interpolated value is HTML-escaped.
//
// Called best-effort by the app; failures never block the order/quote itself.

import {
  json,
  UUID_RE,
  esc,
  eur,
  grossFrom,
  berlinDate,
  isEmail,
  portalUrl,
  itemRows,
  layout,
  mailer,
  serviceDb,
  claimMail,
  finishMail,
  companyRecipients,
  backofficeRecipients,
  quoteMailHtml,
} from './_lib/mail.mjs'

const ORDER_EVENTS = ['created', 'shipped', 'cancelled', 'reclaimed', 'prices_confirmed', 'tracking_updated']
// Admin-only order events.
const ADMIN_EVENTS = ['shipped', 'prices_confirmed', 'tracking_updated']
// Customers may only announce orders / inquiries created within the last hour.
const FRESH_MS = 60 * 60 * 1000
// Back-office inquiry mails per company and hour (flood guard).
const MAX_INQUIRY_MAILS_PER_HOUR = 10

const fail = (status, error) => ({ status, error })

export default async (req, context) => {
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
  if (!me?.id || !UUID_RE.test(me.id)) return json(401, { error: 'Invalid session' })

  // 2) Input: event + the id of the row it is about.
  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const event = body?.event ?? (body?.orderId ? 'created' : null)
  const refId = ORDER_EVENTS.includes(event)
    ? body?.orderId
    : event === 'quote_created'
      ? body?.quoteId
      : event === 'inquiry_created'
        ? body?.inquiryId
        : undefined
  if (refId === undefined) return json(400, { error: 'Unbekanntes Mail-Ereignis' })
  if (typeof refId !== 'string' || !UUID_RE.test(refId)) return json(400, { error: 'Gültige ID erforderlich' })

  const db = serviceDb(URL_, SERVICE)
  const base = portalUrl(context)

  // 3) Caller role (service_role → bypasses RLS).
  const [admins, ownProfiles] = await Promise.all([
    db.get(`b2b_admins?user_id=eq.${me.id}&select=user_id`),
    db.get(`b2b_profiles?user_id=eq.${me.id}&select=company_id`),
  ])
  const caller = {
    isAdmin: Array.isArray(admins) && admins.length > 0,
    companyId: Array.isArray(ownProfiles) ? (ownProfiles[0]?.company_id ?? null) : null,
  }

  // 4) Load the row, authorise, check its state and build the mail.
  const mail = ORDER_EVENTS.includes(event)
    ? await orderMail(db, event, refId, caller, base)
    : event === 'quote_created'
      ? await quoteMail(db, refId, caller, base)
      : await inquiryMail(db, refId, caller, base)
  if (mail.error) return json(mail.status, { error: mail.error })

  // 5) At most once per event and row (per event, row and key for keyed mails).
  const claimed = await claimMail(db, event, refId, me.id, mail.key)
  if (claimed === null) return json(503, { error: 'Mail-Protokoll nicht verfügbar (Migration 014/015 fehlt?)' })
  if (!claimed) return json(200, { ok: true, duplicate: true })

  const send = mailer(KEY, FROM)
  const ok = await send(mail.to, mail.subject, mail.html)
  await finishMail(db, event, refId, ok)

  // Back-office copy: its own mail-log event, so it goes out even when the
  // customer's mail bounced, and a retry never duplicates it.
  if (mail.copy?.to.length && (await claimMail(db, `${event}_bo`, refId, me.id))) {
    const copyOk = await send(mail.copy.to, mail.copy.subject, mail.copy.html)
    await finishMail(db, `${event}_bo`, refId, copyOk)
  }
  if (!ok) return json(502, { error: 'Mailversand fehlgeschlagen' })
  return json(200, { ok: true })
}

// --- Orders ----------------------------------------------------------------
async function orderMail(db, event, orderId, caller, base) {
  const rows = await db.get(
    `b2b_orders?id=eq.${orderId}&select=*,b2b_companies(name),` +
      'b2b_order_items(product_name,color,size,quantity,unit_price)',
  )
  const order = Array.isArray(rows) ? rows[0] : null
  if (!order) return fail(404, 'Bestellung nicht gefunden')

  const isOwner = !!caller.companyId && caller.companyId === order.company_id
  if (!caller.isAdmin && !isOwner) return fail(403, 'Forbidden')
  // The event must match the order's real state (no fake mails).
  if (event === 'created' && !caller.isAdmin && Date.now() - Date.parse(order.created_at) > FRESH_MS) {
    return fail(409, 'Bestellbestätigung nur direkt nach der Bestellung')
  }
  if (ADMIN_EVENTS.includes(event) && !caller.isAdmin) return fail(403, 'Forbidden')
  if ((event === 'shipped' || event === 'tracking_updated') && order.status !== 'versendet') {
    return fail(409, 'Bestellung ist nicht versendet')
  }
  if (event === 'cancelled' && order.status !== 'storniert') return fail(409, 'Bestellung ist nicht storniert')
  if (event === 'reclaimed' && !order.reclamation) return fail(409, 'Keine Reklamation vorhanden')
  if (event === 'prices_confirmed' && (!order.price_confirmed || order.status === 'storniert')) {
    return fail(409, 'Preise sind nicht bestätigt')
  }
  // Tracking update: only with a tracking number, and only after the customer
  // got the shipped mail (that one already carries the tracking data it was
  // sent with; 'historic' = shipped before the mail log existed, see 014).
  const trackingNumber = String(order.tracking_number ?? '').trim()
  const trackingCarrier = String(order.tracking_carrier ?? '').trim()
  if (event === 'tracking_updated') {
    if (!trackingNumber) return fail(409, 'Keine Sendungsnummer hinterlegt')
    const shipped = await db.get(`b2b_mail_log?event=eq.shipped&ref_id=eq.${order.id}&status=in.(sent,historic)&select=id`)
    if (!shipped?.length) return fail(409, 'Versand-Mail wurde noch nicht verschickt')
  }

  // Recipient(s): the company's account e-mail(s), never caller-supplied.
  const to = await companyRecipients(db, order.company_id)
  if (!to.length) return fail(422, 'Keine Empfängeradresse für diese Firma hinterlegt')

  const num = esc(order.order_number)
  const items = Array.isArray(order.b2b_order_items) ? order.b2b_order_items : []
  const net = Number(order.total || 0) + Number(order.shipping || 0)
  const totals =
    `Warenwert ${eur(order.total)} · Versand ${Number(order.shipping) ? eur(order.shipping) : 'kostenlos'} · ` +
    `Gesamt ${eur(grossFrom(net))} brutto (inkl. 19 % USt.)`
  const totalLine = (text) =>
    `<p style="border-top:2px solid #111;margin-top:12px;padding-top:8px;font-weight:700">${esc(text)}</p>`
  const reference = order.po_number ? `<br>Ihr Zeichen: ${esc(order.po_number)}` : ''
  const cta = base ? { href: `${base}/bestellung/${order.id}`, label: 'Bestellung im Portal ansehen' } : null
  const tracking = trackingNumber
    ? `<br>Sendungsnummer: <b>${esc(trackingCarrier)} ${esc(trackingNumber)}</b>` +
      (/^https:\/\/[^\s"'<>]+$/.test(order.tracking_url ?? '') ? ` · <a href="${esc(order.tracking_url)}">Sendung verfolgen</a>` : '')
    : ''

  const copy = {
    created: {
      subject: `Bestellbestätigung #${order.order_number}`,
      title: 'Bestellbestätigung',
      intro: `Ihre Bestellung <b>#${num}</b> ist bei uns eingegangen.${reference}`,
      rows: itemRows(items),
      after: totalLine(order.price_confirmed ? totals : 'Die Preise werden von unserem Team geprüft und Ihnen bestätigt.'),
    },
    shipped: {
      subject: `Ihre Bestellung #${order.order_number} ist unterwegs`,
      title: 'Ihre Bestellung wurde versendet',
      intro: `Ihre Bestellung <b>#${num}</b> hat unser Haus verlassen.${reference}${tracking}`,
      rows: itemRows(items),
      after: '',
    },
    tracking_updated: {
      subject: `Sendungsverfolgung aktualisiert – Bestellung #${order.order_number}`,
      title: 'Sendungsverfolgung aktualisiert',
      intro: `Für Ihre Bestellung <b>#${num}</b> gibt es neue Sendungsdaten.${reference}${tracking}`,
      rows: '',
      after: '',
    },
    cancelled: {
      subject: `Bestellung #${order.order_number} storniert`,
      title: 'Bestellung storniert',
      intro: `Ihre Bestellung <b>#${num}</b> wurde storniert.${reference}`,
      rows: itemRows(items),
      after: '',
    },
    reclaimed: {
      subject: `Ihre Reklamation zu Bestellung #${order.order_number}`,
      title: 'Reklamation eingegangen',
      intro: `Wir haben Ihre Reklamation zu Bestellung <b>#${num}</b> erhalten und melden uns kurzfristig.<br>„${esc(order.reclamation)}“`,
      rows: itemRows(items),
      after: '',
    },
    prices_confirmed: {
      subject: `Preise bestätigt – Bestellung #${order.order_number}`,
      title: 'Preise bestätigt',
      intro: `Wir haben die Preise Ihrer Bestellung <b>#${num}</b> geprüft und bestätigt.${reference}`,
      rows: itemRows(items, true),
      after: totalLine(totals),
    },
  }[event]

  const mail = { to, subject: copy.subject, html: layout({ ...copy, cta }) }
  // One tracking mail per distinct carrier + number (keyed claim, migration 015).
  if (event === 'tracking_updated') mail.key = `${trackingCarrier.toLowerCase()}\n${trackingNumber}`

  // Back office: new orders, cancellations and reclamations made by customers.
  if (!caller.isAdmin && ['created', 'cancelled', 'reclaimed'].includes(event)) {
    const company = order.b2b_companies?.name ?? 'Kunde'
    const label = { created: 'Neue Bestellung', cancelled: 'Storno', reclaimed: 'Reklamation' }[event]
    const verb = { created: 'aufgegeben', cancelled: 'storniert', reclaimed: 'reklamiert' }[event]
    mail.copy = {
      to: await backofficeRecipients(db),
      subject: `${label} #${order.order_number} – ${company}`,
      html: layout({
        title: `${label} #${order.order_number}`,
        intro: `<b>${esc(company)}</b> hat Bestellung <b>#${num}</b> ${verb}.` +
          (event === 'reclaimed' ? `<br>„${esc(order.reclamation)}“` : '') +
          (order.po_number ? `<br>Zeichen des Kunden: ${esc(order.po_number)}` : ''),
        rows: itemRows(items),
        after: event === 'created' ? totalLine(order.price_confirmed ? totals : 'Preise noch zu bestätigen.') : '',
        cta: base ? { href: `${base}/admin/bestellung/${order.id}`, label: 'Im Backoffice öffnen' } : null,
      }),
    }
  }
  return mail
}

// --- Quotes ----------------------------------------------------------------
async function quoteMail(db, quoteId, caller, base) {
  if (!caller.isAdmin) return fail(403, 'Forbidden')
  const rows = await db.get(
    `b2b_quotes?id=eq.${quoteId}&select=*,b2b_quote_items(product_name,color,size,quantity,unit_price)`,
  )
  const quote = Array.isArray(rows) ? rows[0] : null
  if (!quote) return fail(404, 'Angebot nicht gefunden')
  if (quote.status !== 'offen' || quote.withdrawn_at) return fail(409, 'Angebot ist nicht mehr offen')

  const to = await companyRecipients(db, quote.company_id)
  if (!to.length) return fail(422, 'Keine Empfängeradresse für diese Firma hinterlegt')
  return {
    to,
    subject: `Neues Angebot ${quote.quote_number}: ${quote.title}`,
    html: quoteMailHtml(quote, base),
  }
}

// --- Inquiries (to the back office) ----------------------------------------
async function inquiryMail(db, inquiryId, caller, base) {
  const rows = await db.get(`b2b_inquiries?id=eq.${inquiryId}&select=*,b2b_companies(name,customer_number)`)
  const inq = Array.isArray(rows) ? rows[0] : null
  if (!inq) return fail(404, 'Anfrage nicht gefunden')
  if (!caller.companyId || caller.companyId !== inq.company_id) return fail(403, 'Forbidden')
  if (Date.now() - Date.parse(inq.created_at) > FRESH_MS) return fail(409, 'Anfrage ist nicht neu')

  const since = new Date(Date.now() - FRESH_MS).toISOString()
  const recent = await db.get(`b2b_inquiries?company_id=eq.${inq.company_id}&created_at=gte.${encodeURIComponent(since)}&select=id`)
  if ((recent?.length ?? 0) > MAX_INQUIRY_MAILS_PER_HOUR) return fail(429, 'Zu viele Anfragen in kurzer Zeit')

  const to = await backofficeRecipients(db)
  if (!to.length) return fail(422, 'Kein Backoffice-Postfach konfiguriert (ORDER_NOTIFY_TO)')

  const company = inq.b2b_companies?.name ?? 'Kunde'
  const field = (label, html) =>
    html
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;white-space:nowrap">${esc(label)}</td>` +
        `<td style="padding:4px 0;white-space:pre-line">${html}</td></tr>`
      : ''
  const email = String(inq.email ?? '').trim()
  const rowsHtml =
    field('Kunde', esc(company) + (inq.b2b_companies?.customer_number ? ` (${esc(inq.b2b_companies.customer_number)})` : '')) +
    field('Ansprechpartner', esc(inq.contact_person ?? '')) +
    field('E-Mail', isEmail(email) ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : esc(email)) +
    field('Artikel', esc(inq.product_type ?? '')) +
    field('Menge', inq.quantity ? `${esc(inq.quantity)} Stück` : '') +
    field('Wunschtermin', inq.deadline ? esc(berlinDate(`${inq.deadline}T12:00:00Z`)) : '') +
    field('Nachricht', esc(inq.message ?? '')) +
    field('Druckdatei', inq.artwork_name ? `${esc(inq.artwork_name)} (im Backoffice abrufbar)` : '')

  return {
    to,
    subject: `Neue Großanfrage – ${company}: ${inq.product_type ?? ''}`,
    html: layout({
      title: 'Neue Großanfrage',
      intro: `<b>${esc(company)}</b> hat im Portal eine Großanfrage gestellt.`,
      rows: rowsHtml,
      cta: base ? { href: `${base}/admin/anfragen`, label: 'Im Backoffice öffnen' } : null,
    }),
  }
}

export const config = { path: '/api/send-order-email' }
