// Shared helpers for the Ballina mail functions (send-order-email,
// quote-reminders). Not a function itself: Netlify only deploys files directly
// in netlify/functions, or folders with an index / same-named file.

export const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/

export const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// Keep header values (subject) on one line.
export const oneLine = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200)

export const eur = (n) =>
  `${(Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

// Gross = net + VAT rounded once in cents — same rule as grossFrom() in src/lib/utils.ts.
export const grossFrom = (net) => {
  const c = Math.round((Number(net) || 0) * 100 + 1e-9)
  return (c + Math.round(c * 0.19 + 1e-9)) / 100
}

export const berlinDate = (iso) =>
  iso
    ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
    : ''

export const isEmail = (v) => typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v)

// Base URL for links in mails: PORTAL_URL, else the site URL Netlify passes in.
export function portalUrl(context) {
  const raw = process.env.PORTAL_URL || context?.site?.url || process.env.URL || ''
  return /^https?:\/\/[^\s"'<>]+$/.test(raw) ? raw.replace(/\/+$/, '') : ''
}

// "Name · Farbe · Größe" without empty parts (back-office lines may lack colour/size).
export const itemLabel = (it) => [it.product_name, it.color, it.size].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ')

// Item table rows; with prices: quantity × unit price = line total.
export function itemRows(items, withPrices = false) {
  return (Array.isArray(items) ? items : [])
    .map((it) => {
      const qty = Number(it.quantity) || 0
      const price = withPrices
        ? `<td align="right" style="padding:6px 0 6px 12px;white-space:nowrap">${esc(qty)} × ${esc(eur(it.unit_price))}</td>` +
          `<td align="right" style="padding:6px 0 6px 12px;white-space:nowrap">${esc(eur(qty * Number(it.unit_price || 0)))}</td>`
        : `<td align="right" style="padding:6px 0 6px 12px">${esc(qty)}×</td>`
      return `<tr><td style="padding:6px 0">${esc(itemLabel(it))}</td>${price}</tr>`
    })
    .join('')
}

// Common mail frame. `intro` and `after` are HTML the caller already escaped.
export function layout({ title, intro, rows = '', after = '', cta }) {
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1c1c;max-width:560px">
      <h2 style="margin:0 0 4px">${esc(title)}</h2>
      <p style="color:#4b5563;margin:0 0 16px">${intro}</p>
      ${rows ? `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>` : ''}
      ${after}
      ${
        cta?.href
          ? `<p style="margin:24px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;background:#d6206a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">${esc(cta.label)}</a></p>`
          : ''
      }
      <p style="color:#6b7280;font-size:12px;margin-top:24px">Ballina · B2B Textildruck</p>
    </div>`
}

// Resend sender; returns true when Resend accepted the mail.
export function mailer(apiKey, from) {
  return async (to, subject, html) => {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject: oneLine(subject), html }),
      })
      if (!res.ok) console.error('[mail] resend failed', res.status, (await res.text()).slice(0, 300))
      return res.ok
    } catch (e) {
      console.error('[mail] resend unreachable', e?.message)
      return false
    }
  }
}

// Minimal PostgREST client with the service role (bypasses RLS; server only).
export function serviceDb(url, key) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  return {
    async get(path) {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers })
      return r.ok ? r.json() : null
    },
    async rpc(fn, args) {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) })
      const text = await r.text()
      let data = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = text
      }
      return { ok: r.ok, status: r.status, data }
    },
  }
}

/**
 * Claims a mail event in b2b_mail_log (migration 014) — each event is sent at
 * most once per order / quote / inquiry. Returns true (send it), false
 * (already sent / in progress) or null (mail log unavailable → do not send).
 * With `key` (migration 015) the event may be sent again, but only once per
 * distinct key (e.g. the tracking data of a "Sendungsverfolgung" mail).
 */
export async function claimMail(db, event, refId, actor, key) {
  const r = key
    ? await db.rpc('b2b_mail_claim_keyed', { p_event: event, p_ref: refId, p_key: key, p_actor: actor ?? null })
    : await db.rpc('b2b_mail_claim', { p_event: event, p_ref: refId, p_actor: actor ?? null })
  if (!r.ok) {
    console.error(`[mail] ${key ? 'b2b_mail_claim_keyed' : 'b2b_mail_claim'} failed – are migrations 014/015 applied?`, r.status, JSON.stringify(r.data).slice(0, 200))
    return null
  }
  return r.data === true
}

export async function finishMail(db, event, refId, ok) {
  const r = await db.rpc('b2b_mail_done', { p_event: event, p_ref: refId, p_ok: !!ok })
  if (!r.ok) console.error('[mail] b2b_mail_done failed', r.status)
}

// Account e-mail(s) of a company — never caller-supplied.
export async function companyRecipients(db, companyId) {
  const profiles = await db.get(`b2b_profiles?company_id=eq.${companyId}&select=email`)
  return [...new Set((profiles ?? []).map((p) => String(p.email ?? '').trim()).filter(isEmail))]
}

// Back-office inbox(es): ORDER_NOTIFY_TO (comma separated), else the admins' e-mails.
export async function backofficeRecipients(db) {
  const configured = (process.env.ORDER_NOTIFY_TO ?? '').split(',').map((x) => x.trim()).filter(isEmail)
  if (configured.length) return [...new Set(configured)]
  const admins = await db.get('b2b_admins?select=email')
  return [...new Set((admins ?? []).map((a) => String(a.email ?? '').trim()).filter(isEmail))]
}

// Quote mail body (new quote and expiry reminder).
export function quoteMailHtml(quote, base, { reminder = false } = {}) {
  const num = esc(quote.quote_number)
  const until = berlinDate(quote.valid_until)
  const intro = reminder
    ? `Ihr Angebot <b>${num}</b> „${esc(quote.title)}“ ist nur noch bis <b>${esc(until)}</b> gültig. ` +
      'Wenn Sie es annehmen möchten, können Sie das bis dahin direkt im Portal tun.'
    : `Für Sie liegt ein neues Angebot bereit: <b>${num}</b> „${esc(quote.title)}“.` +
      (until ? ` Es ist gültig bis <b>${esc(until)}</b>.` : '')
  const items = Array.isArray(quote.b2b_quote_items) ? quote.b2b_quote_items : []
  const after =
    `<p style="border-top:2px solid #111;margin-top:12px;padding-top:8px;font-weight:700">` +
    `Summe ${esc(eur(quote.total))} netto <span style="font-weight:400;color:#6b7280">zzgl. Versand und 19 % USt.</span></p>` +
    (quote.note ? `<p style="white-space:pre-line;color:#4b5563">${esc(quote.note)}</p>` : '')
  return layout({
    title: reminder ? 'Ihr Angebot läuft bald ab' : 'Neues Angebot',
    intro,
    rows: itemRows(items, true),
    after,
    cta: base ? { href: `${base}/angebote`, label: 'Angebot im Portal ansehen' } : null,
  })
}
