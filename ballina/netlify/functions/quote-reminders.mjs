// Netlify Scheduled Function — reminds customers of open quotes that expire
// within the next REMIND_DAYS days (Berlin calendar days). Runs daily; each
// quote gets at most one reminder (b2b_mail_log event 'quote_reminder',
// migration 014). Quotes younger than MIN_AGE_DAYS are skipped — the
// "Neues Angebot" mail is still fresh.
//
// Env: RESEND_API_KEY, ORDER_MAIL_FROM, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional: PORTAL_URL (link base). Without Resend keys the run does nothing.

import {
  json,
  berlinDate,
  portalUrl,
  mailer,
  serviceDb,
  claimMail,
  finishMail,
  companyRecipients,
  quoteMailHtml,
} from './_lib/mail.mjs'

const REMIND_DAYS = 3
const MIN_AGE_DAYS = 2
const DAY = 24 * 60 * 60 * 1000

// Whole Berlin calendar days from today until the quote's last valid day.
const berlinDay = (d) => new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d)).getTime()
const daysLeft = (iso, now) => Math.round((berlinDay(new Date(iso)) - berlinDay(now)) / DAY)

export default async (req, context) => {
  const KEY = process.env.RESEND_API_KEY
  const FROM = process.env.ORDER_MAIL_FROM
  const URL_ = process.env.SUPABASE_URL
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!KEY || !FROM || !URL_ || !SERVICE) {
    console.log('[quote-reminders] mail or Supabase env vars missing – skipped')
    return json(200, { ok: true, skipped: 'not configured' })
  }

  const db = serviceDb(URL_, SERVICE)
  const base = portalUrl(context)
  const send = mailer(KEY, FROM)
  const now = new Date()

  const from = now.toISOString()
  const until = new Date(now.getTime() + (REMIND_DAYS + 1) * DAY).toISOString()
  const createdBefore = new Date(now.getTime() - MIN_AGE_DAYS * DAY).toISOString()
  const quotes = await db.get(
    'b2b_quotes?status=eq.offen&withdrawn_at=is.null' +
      `&valid_until=gte.${encodeURIComponent(from)}&valid_until=lt.${encodeURIComponent(until)}` +
      `&created_at=lt.${encodeURIComponent(createdBefore)}` +
      '&select=*,b2b_quote_items(product_name,color,size,quantity,unit_price)&order=valid_until.asc&limit=200',
  )
  if (!Array.isArray(quotes)) {
    console.error('[quote-reminders] could not load quotes')
    return json(500, { error: 'Angebote konnten nicht geladen werden' })
  }

  let sent = 0
  for (const quote of quotes) {
    const left = daysLeft(quote.valid_until, now)
    if (left < 0 || left > REMIND_DAYS) continue
    const to = await companyRecipients(db, quote.company_id)
    if (!to.length) continue
    const claimed = await claimMail(db, 'quote_reminder', quote.id, null)
    if (claimed === null) return json(503, { error: 'Mail-Protokoll nicht verfügbar (Migration 014 fehlt?)' })
    if (!claimed) continue
    const ok = await send(
      to,
      `Erinnerung: Angebot ${quote.quote_number} gültig bis ${berlinDate(quote.valid_until)}`,
      quoteMailHtml(quote, base, { reminder: true }),
    )
    await finishMail(db, 'quote_reminder', quote.id, ok)
    if (ok) sent++
  }
  console.log(`[quote-reminders] ${sent} reminder(s) sent, ${quotes.length} candidate(s)`)
  return json(200, { ok: true, sent, candidates: quotes.length })
}

// 06:30 UTC = 07:30 / 08:30 Berlin.
export const config = { schedule: '30 6 * * *' }
