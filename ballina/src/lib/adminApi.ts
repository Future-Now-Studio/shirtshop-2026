import { supabase, USE_MOCK } from './supabase'
import { uploadInvoice } from './invoices'
import { ADMIN_CUSTOMERS, ADMIN_INQUIRIES, ADMIN_ORDERS, ADMIN_QUOTES } from './adminMock'
import { MOCK_ORDERS } from './mockData'
import { sendOrderEmail, sendPortalMail } from './api'
import { berlinYear, berlinYearRange, budgetSpent } from './utils'
import type {
  Address,
  AdminInquiry,
  AdminOrder,
  AdminOrderListItem,
  AdminQuote,
  AdminQuoteListItem,
  AuditEntry,
  Page,
  Company,
  InternalNote,
  OrderItem,
  OrderStatus,
  QuoteStatus,
  ReclamationStatus,
} from './types'

const REAL = !USE_MOCK && !!supabase
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms))

/** Page sizes for the "Mehr laden" lists. */
export const ORDERS_PAGE_SIZE = 50
export const CUSTOMERS_PAGE_SIZE = 50
export const QUOTES_PAGE_SIZE = 50
export const INQUIRIES_PAGE_SIZE = 50
export const AUDIT_PAGE_SIZE = 100
/** Upper bound for one CSV export (fetched in chunks, PostgREST caps 1000/request). */
export const EXPORT_MAX_ROWS = 10_000

/**
 * Make free text safe for a PostgREST `or=(…)` ilike filter: drop the
 * characters that carry syntax there (, . ( ) " \ * %) and collapse spaces.
 */
function searchTerm(raw: string): string {
  return raw.replace(/[,.()"\\*%:#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

/** PostgREST/Postgres error → Error with the (German) DB message. */
function asError(e: { message?: string } | null | undefined, fallback = 'Unbekannter Fehler'): Error {
  return new Error(e?.message || fallback)
}

/** UTC instant of 00:00 Europe/Berlin on a calendar date (YYYY-MM-DD). */
function berlinStartOfDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
      .formatToParts(new Date(utc))
      .map((p) => [p.type, p.value]),
  )
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
  return new Date(utc - (wall - utc)).toISOString()
}

/** Next calendar day of a YYYY-MM-DD date. */
function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Only absolute https links are stored as tracking link (rendered as <a href>). */
export function isHttpsUrl(raw: string): boolean {
  if (!/^https:\/\/\S+$/.test(raw)) return false
  try {
    return new URL(raw).protocol === 'https:'
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// localStorage-backed mock helpers
// ---------------------------------------------------------------------------
function load<T>(key: string, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T[]
  } catch {
    /* ignore */
  }
  return structuredClone(seed)
}
function save<T>(key: string, value: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

const K_ORDERS = 'ballina_admin_orders'
const K_QUOTES = 'ballina_admin_quotes'
const K_INQ = 'ballina_admin_inquiries'
const K_CUST = 'ballina_admin_customers'
const K_AUDIT = 'ballina_admin_audit'
const K_NOTES = 'ballina_admin_notes'

function logAuditMock(action: string, entity: string, detail: string) {
  const list = load<AuditEntry>(K_AUDIT, [])
  list.unshift({ id: `au_${list.length + 1}_${entity}`, at: new Date().toISOString(), actor: 'admin@ballina.de', action, entity, detail })
  save(K_AUDIT, list)
}

// ---------------------------------------------------------------------------
// Real (Supabase) helpers — admin reaches every company via is_admin() RLS.
// ---------------------------------------------------------------------------
function mapCompany(r: any): Company {
  const prof = Array.isArray(r.b2b_profiles) ? r.b2b_profiles[0] : r.b2b_profiles
  const billing = r.billing_line1
    ? { line1: r.billing_line1, zip: r.billing_zip ?? '', city: r.billing_city ?? '', country: r.billing_country ?? undefined }
    : undefined
  const delivery = r.delivery_line1
    ? { line1: r.delivery_line1, zip: r.delivery_zip ?? '', city: r.delivery_city ?? '', country: r.delivery_country ?? undefined }
    : undefined
  return {
    id: r.id,
    company: r.name,
    contactPerson: prof?.name ?? '',
    email: prof?.email ?? '',
    phone: prof?.phone ?? undefined,
    customerNumber: r.customer_number ?? undefined,
    vatId: r.vat_id ?? undefined,
    billingAddress: billing,
    deliveryAddress: delivery,
    paymentTerms: r.payment_terms ?? undefined,
    discountPercent: r.discount_percent != null ? Number(r.discount_percent) : undefined,
    annualBudget: r.annual_budget != null ? Number(r.annual_budget) : undefined,
  }
}

function mapItems(rows: any[]): OrderItem[] {
  return (rows ?? []).map((it) => ({
    id: it.id,
    productId: it.product_id,
    productName: it.product_name,
    imageUrl: it.image_url ?? '',
    color: it.color,
    size: it.size,
    quantity: it.quantity,
    unitPrice: Number(it.unit_price ?? 0),
    printPosition: it.print_position ?? undefined,
    artworkName: it.artwork_name ?? undefined,
    artworkPath: it.artwork_path ?? undefined,
  }))
}

/** b2b_orders.delivery_address (012: {name?, line1, zip, city, country?}); null = company default. */
function mapDeliveryAddress(a: unknown): Address | undefined {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return undefined
  const o = a as Record<string, unknown>
  const s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : '')
  if (!s('line1') && !s('city')) return undefined
  return { name: s('name') || undefined, line1: s('line1'), zip: s('zip'), city: s('city'), country: s('country') || undefined }
}

function mapAdminOrder(r: any): AdminOrder {
  const events = (r.b2b_order_events ?? [])
    .map((e: any) => ({ status: e.status, at: e.at, note: e.note ?? undefined }))
    .sort((a: any, b: any) => a.at.localeCompare(b.at))
  return {
    id: r.id,
    companyId: r.company_id,
    companyName: r.b2b_companies?.name ?? '—',
    orderNumber: r.order_number,
    status: r.status,
    total: Number(r.total ?? 0),
    shipping: Number(r.shipping ?? 0),
    priceConfirmed: r.price_confirmed ?? true,
    note: r.note ?? undefined,
    createdAt: r.created_at,
    trackingCarrier: r.tracking_carrier ?? undefined,
    trackingNumber: r.tracking_number ?? undefined,
    trackingUrl: r.tracking_url ?? undefined,
    reclamation: r.reclamation ?? undefined,
    reclamationStatus: r.reclamation ? ((r.reclamation_status as ReclamationStatus | null) ?? 'offen') : undefined,
    reclamationResolvedAt: r.reclamation_resolved_at ?? undefined,
    // Columns from 012 — absent (undefined) until that migration is applied.
    poNumber: r.po_number ?? undefined,
    requestedDate: r.requested_date ?? undefined,
    deliveryAddress: mapDeliveryAddress(r.delivery_address),
    invoiceName: r.invoice_name ?? undefined,
    invoiceDataUrl: r.invoice_url ?? undefined,
    statusHistory: events.length ? events : undefined,
    items: mapItems(r.b2b_order_items),
  }
}

function mapAdminQuote(r: any): AdminQuote {
  return {
    id: r.id,
    companyId: r.company_id,
    companyName: r.b2b_companies?.name ?? '—',
    quoteNumber: r.quote_number,
    orderId: r.order_id ?? undefined,
    title: r.title,
    createdAt: r.created_at,
    validUntil: r.valid_until,
    status: r.status,
    total: Number(r.total ?? 0),
    note: r.note ?? undefined,
    withdrawnAt: r.withdrawn_at ?? undefined,
    inquiryId: r.inquiry_id ?? undefined,
    items: mapItems(r.b2b_quote_items),
  }
}

async function logAuditReal(action: string, entity: string, detail: string, companyId?: string) {
  if (!supabase) return
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('b2b_audit_log').insert({
    company_id: companyId ?? null,
    actor: user?.id ?? null,
    action,
    entity,
    meta: { detail },
  })
}

const ORDER_SELECT = '*, b2b_order_items(*), b2b_order_events(*), b2b_companies(name)'
const QUOTE_SELECT = '*, b2b_quote_items(*), b2b_companies(name)'

/**
 * Whether b2b_orders has the structured order columns of migration 012
 * (po_number, …). Probed once; the order search only uses them if present.
 */
let orderMetaColumns: Promise<boolean> | null = null
function hasOrderMetaColumns(): Promise<boolean> {
  if (!REAL) return Promise.resolve(false)
  orderMetaColumns ??= Promise.resolve(
    supabase!.from('b2b_orders').select('po_number').limit(1),
  ).then(
    ({ error }) => {
      if (!error) return true
      // 42703 = column missing (012 not applied) → cache; anything else → probe again next time.
      if (error.code !== '42703') orderMetaColumns = null
      return false
    },
    () => {
      orderMetaColumns = null
      return false
    },
  )
  return orderMetaColumns
}

/** Companies whose name or customer number matches (for order/quote search). */
async function matchingCompanyIds(term: string): Promise<string[]> {
  const { data, error } = await supabase!
    .from('b2b_companies')
    .select('id')
    .or(`name.ilike.*${term}*,customer_number.ilike.*${term}*`)
    .limit(200)
  if (error) throw asError(error)
  return (data ?? []).map((c: any) => c.id as string)
}

// ===========================================================================
// Customers
// ===========================================================================
/** Paged + server-side searched customer list (Kunden page, customer picker). */
export async function adminGetCustomersPage(search: string, offset: number, limit = CUSTOMERS_PAGE_SIZE): Promise<Page<Company>> {
  const term = searchTerm(search)
  if (REAL) {
    let query = supabase!
      .from('b2b_companies')
      .select('*, b2b_profiles(name,email,phone)', { count: 'exact' })
      .order('name')
      .order('id')
      .range(offset, offset + limit - 1)
    if (term) {
      // Contact name / e-mail live on the profile → resolve matching companies first.
      const { data: profs, error: pErr } = await supabase!
        .from('b2b_profiles')
        .select('company_id')
        .or(`name.ilike.*${term}*,email.ilike.*${term}*`)
        .limit(200)
      if (pErr) throw pErr
      const ids = [...new Set((profs ?? []).map((p: any) => p.company_id as string))]
      const ors = [`name.ilike.*${term}*`, `customer_number.ilike.*${term}*`, `billing_city.ilike.*${term}*`]
      if (ids.length) ors.push(`id.in.(${ids.join(',')})`)
      query = query.or(ors.join(','))
    }
    const { data, error, count } = await query
    if (error) throw error
    const rows = (data ?? []).map(mapCompany)
    return { rows, total: count ?? undefined, hasMore: count != null ? offset + rows.length < count : rows.length === limit }
  }
  await delay()
  const t = term.toLowerCase()
  const all = load(K_CUST, ADMIN_CUSTOMERS)
    .filter((c) => !t || [c.company, c.customerNumber, c.contactPerson, c.email, c.billingAddress?.city]
      .some((v) => (v ?? '').toLowerCase().includes(t)))
    .sort((a, b) => a.company.localeCompare(b.company, 'de'))
  const rows = all.slice(offset, offset + limit)
  return { rows, total: all.length, hasMore: offset + rows.length < all.length }
}

/** Net total of a company's non-cancelled orders in a Berlin calendar year. */
export async function adminGetBudgetSpent(companyId: string, year: number): Promise<number> {
  if (REAL) {
    const { from, to } = berlinYearRange(year)
    const { data, error } = await supabase!
      .from('b2b_orders')
      .select('total')
      .eq('company_id', companyId)
      .neq('status', 'storniert')
      .gte('created_at', from)
      .lt('created_at', to)
    if (error) throw error
    return Math.round((data ?? []).reduce((s: number, r: any) => s + Number(r.total ?? 0), 0) * 100) / 100
  }
  await delay()
  return budgetSpent(load(K_ORDERS, ADMIN_ORDERS).filter((o) => o.companyId === companyId), year)
}

export async function adminGetCustomer(id: string): Promise<Company | null> {
  if (REAL) {
    const { data, error } = await supabase!
      .from('b2b_companies')
      .select('*, b2b_profiles(name,email,phone)')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? mapCompany(data) : null
  }
  await delay()
  return load(K_CUST, ADMIN_CUSTOMERS).find((c) => c.id === id) ?? null
}

/** Discount must be a percentage 0–100 (DB check b2b_companies_discount_range). */
function checkDiscount(v: number | undefined) {
  if (v === undefined) return
  if (!Number.isFinite(v) || v < 0 || v > 100) throw new Error('Rabatt muss zwischen 0 und 100 % liegen.')
}

/**
 * Update company master data. For `annualBudget`, `billingAddress` and
 * `deliveryAddress` an explicitly passed `undefined` clears the value.
 */
export async function adminUpdateCustomer(id: string, patch: Partial<Company>): Promise<Company> {
  checkDiscount(patch.discountPercent)
  if (patch.annualBudget !== undefined && (!Number.isFinite(patch.annualBudget) || patch.annualBudget < 0)) {
    throw new Error('Das Jahresbudget darf nicht negativ sein.')
  }
  if (patch.company !== undefined && !patch.company.trim()) throw new Error('Bitte einen Firmennamen angeben.')
  if (REAL) {
    const row: Record<string, unknown> = {}
    if (patch.discountPercent !== undefined) row.discount_percent = patch.discountPercent
    if ('annualBudget' in patch) row.annual_budget = patch.annualBudget ?? null
    if (patch.paymentTerms !== undefined) row.payment_terms = patch.paymentTerms
    if (patch.company !== undefined) row.name = patch.company.trim()
    if (patch.vatId !== undefined) row.vat_id = patch.vatId || null
    for (const [key, prefix] of [['billingAddress', 'billing'], ['deliveryAddress', 'delivery']] as const) {
      if (!(key in patch)) continue
      const a = patch[key]
      row[`${prefix}_line1`] = a?.line1 || null
      row[`${prefix}_zip`] = a?.zip || null
      row[`${prefix}_city`] = a?.city || null
      row[`${prefix}_country`] = a ? a.country || 'DE' : null
    }
    if (Object.keys(row).length) {
      const { error: compErr } = await supabase!.from('b2b_companies').update(row).eq('id', id)
      if (compErr) throw compErr
    }
    // Contact name + phone live on the profile (one account per company), so
    // persist those on b2b_profiles rather than the company row.
    const prof: Record<string, unknown> = {}
    if (patch.contactPerson !== undefined) prof.name = patch.contactPerson
    if (patch.phone !== undefined) prof.phone = patch.phone || null
    if (Object.keys(prof).length) {
      const { error: profErr } = await supabase!.from('b2b_profiles').update(prof).eq('company_id', id)
      if (profErr) throw profErr
    }
    const { data, error } = await supabase!
      .from('b2b_companies')
      .select('*, b2b_profiles(name,email,phone)')
      .eq('id', id)
      .single()
    if (error) throw error
    await logAuditReal('kunde.aktualisiert', data.name, 'Konditionen/Stammdaten geändert', id)
    return mapCompany(data)
  }
  await delay(300)
  const list = load(K_CUST, ADMIN_CUSTOMERS)
  const idx = list.findIndex((c) => c.id === id)
  if (idx < 0) throw new Error('Kunde nicht gefunden.')
  list[idx] = { ...list[idx], ...patch }
  save(K_CUST, list)
  logAuditMock('kunde.aktualisiert', list[idx].company, 'Konditionen/Stammdaten geändert')
  return list[idx]
}

interface InviteResult {
  error?: string
  /** true = an existing, unconfirmed login got the invite again. */
  resent?: boolean
}

/** POST /api/admin-create-user (creates the login or re-sends the invite); never throws. */
async function callInviteFunction(payload: { companyId: string; email: string; name?: string; phone?: string }): Promise<InviteResult> {
  try {
    const { data: sess } = await supabase!.auth.getSession()
    const token = sess.session?.access_token
    if (!token) return { error: 'Keine gültige Sitzung – bitte neu anmelden.' }
    const res = await fetch('/api/admin-create-user', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    // Only a JSON success body counts: an SPA fallback (index.html, 200)
    // means the function is not deployed and nothing was sent.
    const body = await res.json().catch(() => null)
    if (!res.ok) return { error: body?.error ?? `HTTP ${res.status}` }
    if (body?.ok !== true || !body?.userId) {
      return { error: 'Unerwartete Antwort der Invite-Function (ist sie auf Netlify deployed?).' }
    }
    return { resent: body.resent === true }
  } catch {
    return { error: 'Invite-Function nicht erreichbar (ist sie auf Netlify deployed?).' }
  }
}

/**
 * "Einladung erneut senden": same company id + login e-mail again to
 * admin-create-user. Works while the customer has not set a password yet;
 * otherwise the function answers with a readable error (→ "Passwort vergessen?").
 */
export async function adminResendInvite(customer: Company): Promise<void> {
  const email = customer.email?.trim()
  if (!email) throw new Error('Für diesen Kunden ist keine Login-E-Mail hinterlegt.')
  if (REAL) {
    const { error } = await callInviteFunction({ companyId: customer.id, email, name: customer.contactPerson || undefined })
    if (error) throw new Error(error)
    await logAuditReal('kunde.einladung', customer.company, `Einladung erneut an ${email} gesendet`, customer.id)
    return
  }
  await delay(400)
  logAuditMock('kunde.einladung', customer.company, `Einladung erneut an ${email} gesendet`)
}

export interface NewCustomerInput {
  company: string
  contactPerson: string
  email: string
  phone?: string
  discountPercent?: number
  annualBudget?: number
  paymentTerms?: string
}
export async function adminCreateCustomer(input: NewCustomerInput): Promise<Company> {
  checkDiscount(input.discountPercent)
  if (REAL) {
    // customer_number comes from the DB sequence (b2b_customer_seq).
    const { data, error } = await supabase!
      .from('b2b_companies')
      .insert({
        name: input.company,
        discount_percent: input.discountPercent ?? 0,
        annual_budget: input.annualBudget ?? null,
        payment_terms: input.paymentTerms ?? '14 Tage netto',
      })
      .select('*')
      .single()
    if (error) throw error

    // Create the login account + send the invite via the serverless function
    // (uses service_role; a browser cannot create auth users safely). If that
    // fails, remove the company again and surface the error to the admin, so
    // no customer is left without a working login and a retry is possible.
    const { error: inviteError } = await callInviteFunction({
      companyId: data.id,
      email: input.email,
      name: input.contactPerson,
      phone: input.phone,
    })
    if (inviteError) {
      await supabase!.from('b2b_companies').delete().eq('id', data.id)
      throw new Error(`Kunde nicht angelegt – Einladung fehlgeschlagen: ${inviteError}`)
    }

    await logAuditReal('kunde.angelegt', data.name, `Neukunde ${data.customer_number}, Einladung an ${input.email} versendet`, data.id)
    return mapCompany({ ...data, b2b_profiles: [{ name: input.contactPerson, email: input.email, phone: input.phone }] })
  }
  await delay(350)
  const list = load(K_CUST, ADMIN_CUSTOMERS)
  const num = 10700 + list.length
  const customer: Company = {
    id: `c_${Date.now()}`,
    company: input.company,
    contactPerson: input.contactPerson,
    email: input.email,
    phone: input.phone,
    customerNumber: `B2B-${num}`,
    discountPercent: input.discountPercent ?? 0,
    annualBudget: input.annualBudget,
    paymentTerms: input.paymentTerms ?? '14 Tage netto',
  }
  save(K_CUST, [...list, customer])
  logAuditMock('kunde.angelegt', customer.company, `Neukunde ${customer.customerNumber}`)
  return customer
}

// ===========================================================================
// Internal notes (admin-only tables from migration 013)
// ===========================================================================
export type NoteTarget = { orderId: string } | { companyId: string }

function noteTable(t: NoteTarget) {
  return 'orderId' in t
    ? { table: 'b2b_order_notes', column: 'order_id', id: t.orderId }
    : { table: 'b2b_company_notes', column: 'company_id', id: t.companyId }
}

/** Internal notes, newest first. Never readable by customers (RLS: is_admin()). */
export async function adminGetNotes(target: NoteTarget): Promise<InternalNote[]> {
  const { table, column, id } = noteTable(target)
  if (REAL) {
    const { data, error } = await supabase!
      .from(table)
      .select('*')
      .eq(column, id)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw asError(error)
    return (data ?? []).map((r: any) => ({
      id: r.id,
      kind: r.kind ?? 'notiz',
      body: r.body,
      authorEmail: r.author_email ?? undefined,
      createdAt: r.created_at,
    }))
  }
  await delay()
  return load<InternalNote & { target: string }>(K_NOTES, [])
    .filter((n) => n.target === `${table}:${id}`)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function adminAddNote(target: NoteTarget, body: string): Promise<void> {
  const text = body.trim()
  if (!text) throw new Error('Bitte einen Text eingeben.')
  if (text.length > 4000) throw new Error('Notiz ist zu lang (max. 4000 Zeichen).')
  const { table, column, id } = noteTable(target)
  if (REAL) {
    // Author and timestamp are set by the database (trigger b2b_notes_stamp).
    const { error } = await supabase!.from(table).insert({ [column]: id, body: text })
    if (error) throw asError(error)
    return
  }
  await delay()
  const list = load<InternalNote & { target: string }>(K_NOTES, [])
  list.push({ id: `n_${Date.now()}`, kind: 'notiz', body: text, authorEmail: 'admin@ballina.de', createdAt: new Date().toISOString(), target: `${table}:${id}` })
  save(K_NOTES, list)
}

// ===========================================================================
// Audit log
// ===========================================================================
const AUDIT_SEED: AuditEntry[] = [
  { id: 'as1', at: '2026-08-30T16:45:00Z', actor: 'admin@ballina.de', action: 'bestellung.status', entity: '#2026-0470', detail: 'Status → versendet, DHL' },
  { id: 'as2', at: '2026-08-29T10:12:00Z', actor: 'admin@ballina.de', action: 'angebot.gesendet', entity: 'AN-2026-0088', detail: 'An Brauhaus Lindental GmbH' },
  { id: 'as3', at: '2026-08-27T09:31:00Z', actor: 'admin@ballina.de', action: 'kunde.angelegt', entity: 'Alpenblick Hotel & Resort', detail: 'B2B-10517' },
]
export interface AuditCursor { at: string; id: string }

function mapAudit(r: any): AuditEntry {
  return {
    id: String(r.id),
    at: r.at,
    actor: r.actor ?? '',
    actorEmail: r.actor_email ?? undefined,
    companyName: r.company_name ?? undefined,
    action: r.action,
    entity: r.entity ?? '',
    detail: r.meta?.detail ?? '',
  }
}

/**
 * One page of the audit log, newest first (keyset pagination on at/id).
 * Uses the admin-only RPC admin_audit_log (migration 011) which resolves the
 * actor's e-mail from auth.users — b2b_admins is not readable across admins
 * under RLS. Falls back to the plain table (no e-mails) if 011 is missing.
 */
export async function adminGetAudit(cursor?: AuditCursor): Promise<Page<AuditEntry>> {
  const limit = AUDIT_PAGE_SIZE
  if (REAL) {
    const rpc = await supabase!.rpc('admin_audit_log', {
      p_limit: limit,
      p_before_at: cursor?.at ?? null,
      p_before_id: cursor ? Number(cursor.id) : null,
    })
    if (!rpc.error) {
      const rows = (rpc.data ?? []).map(mapAudit)
      return { rows, hasMore: rows.length === limit }
    }
    // PGRST202 = function not found (011 not applied yet) → degrade gracefully.
    if (rpc.error.code !== 'PGRST202') throw rpc.error
    let query = supabase!
      .from('b2b_audit_log')
      .select('*')
      .order('at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)
    if (cursor) query = query.or(`at.lt."${cursor.at}",and(at.eq."${cursor.at}",id.lt.${Number(cursor.id)})`)
    const { data, error } = await query
    if (error) throw error
    const rows = (data ?? []).map(mapAudit)
    return { rows, hasMore: rows.length === limit }
  }
  await delay()
  const live = load<AuditEntry>(K_AUDIT, [])
  const all = [...live, ...AUDIT_SEED]
    .map((e) => ({ ...e, actorEmail: e.actorEmail ?? (e.actor.includes('@') ? e.actor : undefined) }))
    .sort((a, b) => b.at.localeCompare(a.at))
  const start = cursor ? all.findIndex((e) => e.id === cursor.id) + 1 : 0
  const rows = all.slice(start, start + limit)
  return { rows, hasMore: start + rows.length < all.length }
}

// ===========================================================================
// Orders
// ===========================================================================
/**
 * Order list filter: a status, all orders, orders whose prices still need
 * confirmation, or orders with an unresolved reclamation.
 */
export type OrderFilter = OrderStatus | 'alle' | 'unbestaetigt' | 'reklamation'

export interface OrderQuery {
  filter: OrderFilter
  /** Order number, company name, customer number or Bestellzeichen. */
  search: string
  /** Inclusive Berlin calendar dates (YYYY-MM-DD). */
  from?: string
  to?: string
}

function toListItem(o: AdminOrder, itemCount: number): AdminOrderListItem {
  const rest: Partial<AdminOrder> = { ...o }
  delete rest.items
  delete rest.statusHistory
  return { ...(rest as Omit<AdminOrder, 'items' | 'statusHistory'>), itemCount }
}

function mapAdminOrderListItem(r: any): AdminOrderListItem {
  // b2b_order_items(count) comes back as [{ count: n }]
  const agg = Array.isArray(r.b2b_order_items) ? r.b2b_order_items[0] : r.b2b_order_items
  return toListItem(mapAdminOrder({ ...r, b2b_order_items: [], b2b_order_events: [] }), Number(agg?.count ?? 0))
}

/** Apply filter / date range / search of an OrderQuery to a b2b_orders query. */
async function applyOrderQuery<Q extends { eq: any; gte: any; lt: any; not: any; or: any }>(query: Q, q: OrderQuery): Promise<Q> {
  let out: any = query
  if (q.filter === 'unbestaetigt') out = out.eq('price_confirmed', false).neq('status', 'storniert')
  else if (q.filter === 'reklamation') out = out.not('reclamation', 'is', null).or('reclamation_status.is.null,reclamation_status.neq.erledigt')
  else if (q.filter !== 'alle') out = out.eq('status', q.filter)
  if (q.from && YMD.test(q.from)) out = out.gte('created_at', berlinStartOfDay(q.from))
  if (q.to && YMD.test(q.to)) out = out.lt('created_at', berlinStartOfDay(nextDay(q.to)))
  const term = searchTerm(q.search)
  if (term) {
    const [ids, meta] = await Promise.all([matchingCompanyIds(term), hasOrderMetaColumns()])
    const ors = [`order_number.ilike.*${term}*`]
    if (meta) ors.push(`po_number.ilike.*${term}*`)
    if (ids.length) ors.push(`company_id.in.(${ids.join(',')})`)
    out = out.or(ors.join(','))
  }
  return out as Q
}

function mockOrderMatches(o: AdminOrder, q: OrderQuery): boolean {
  if (q.filter === 'unbestaetigt' && (o.priceConfirmed !== false || o.status === 'storniert')) return false
  if (q.filter === 'reklamation' && (!o.reclamation || o.reclamationStatus === 'erledigt')) return false
  if (!['alle', 'unbestaetigt', 'reklamation'].includes(q.filter) && o.status !== q.filter) return false
  if (q.from && YMD.test(q.from) && o.createdAt < berlinStartOfDay(q.from)) return false
  if (q.to && YMD.test(q.to) && o.createdAt >= berlinStartOfDay(nextDay(q.to))) return false
  const t = searchTerm(q.search).toLowerCase()
  return !t || [o.orderNumber, o.companyName, o.poNumber].some((v) => (v ?? '').toLowerCase().includes(t))
}

/**
 * Paged back-office order list, newest first. Items are only counted, not
 * loaded.
 */
export async function adminGetOrdersPage(q: OrderQuery, offset: number): Promise<Page<AdminOrderListItem>> {
  const limit = ORDERS_PAGE_SIZE
  if (REAL) {
    const base = supabase!
      .from('b2b_orders')
      .select('*, b2b_order_items(count), b2b_companies(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)
    const { data, error, count } = await applyOrderQuery(base, q)
    if (error) throw asError(error)
    const rows = (data ?? []).map(mapAdminOrderListItem)
    return { rows, total: count ?? undefined, hasMore: count != null ? offset + rows.length < count : rows.length === limit }
  }
  await delay()
  const all = load(K_ORDERS, ADMIN_ORDERS)
    .filter((o) => mockOrderMatches(o, q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const rows = all.slice(offset, offset + limit).map((o) => toListItem(o, o.items.length))
  return { rows, total: all.length, hasMore: offset + rows.length < all.length }
}

export type OrderCounts = Record<Exclude<OrderFilter, 'alle'>, number>

/** Number of orders per filter chip — head-only count queries. */
export async function adminGetOrderCounts(): Promise<OrderCounts> {
  const keys: Exclude<OrderFilter, 'alle'>[] = ['unbestaetigt', 'reklamation', 'offen', 'in_bearbeitung', 'versendet', 'abgeschlossen', 'storniert']
  if (REAL) {
    const res = await Promise.all(
      keys.map(async (k) => {
        const head = supabase!.from('b2b_orders').select('id', { count: 'exact', head: true })
        return applyOrderQuery(head, { filter: k, search: '' })
      }),
    )
    const err = res.find((r) => r.error)?.error
    if (err) throw asError(err)
    return Object.fromEntries(keys.map((k, i) => [k, res[i].count ?? 0])) as OrderCounts
  }
  const all = load(K_ORDERS, ADMIN_ORDERS)
  return Object.fromEntries(keys.map((k) => [k, all.filter((o) => mockOrderMatches(o, { filter: k, search: '' })).length])) as OrderCounts
}

/** Row of a CSV export: one per order, or one per order position. */
export interface OrderExportRow {
  order: AdminOrderListItem & { customerNumber?: string }
  item?: OrderItem
}

/**
 * All orders matching the query (newest first) for the CSV export, fetched in
 * chunks. Rejects above EXPORT_MAX_ROWS so a truncated file is never produced.
 */
export async function adminExportOrders(q: OrderQuery, withItems: boolean): Promise<OrderExportRow[]> {
  if (REAL) {
    const chunk = withItems ? 250 : 1000
    const out: OrderExportRow[] = []
    let expected = 0
    // Advance by the rows actually received: the server may cap a request
    // below `chunk` (PostgREST max-rows), which must neither skip nor truncate.
    let offset = 0
    for (;;) {
      const base = supabase!
        .from('b2b_orders')
        .select(
          `*, b2b_order_items(${withItems ? '*' : 'count'}), b2b_companies(name, customer_number)`,
          offset === 0 ? { count: 'exact' } : undefined,
        )
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + chunk - 1)
      const { data, error, count } = await applyOrderQuery(base, q)
      if (error) throw asError(error)
      if (offset === 0) {
        // No count → read until an empty chunk.
        expected = count ?? Number.POSITIVE_INFINITY
        if (expected > EXPORT_MAX_ROWS && count != null) {
          throw new Error(`Zu viele Bestellungen (${count}) für einen Export – bitte Zeitraum oder Filter eingrenzen.`)
        }
      }
      offset += data?.length ?? 0
      for (const r of data ?? []) {
        const items = withItems ? mapItems(r.b2b_order_items) : []
        const order = {
          ...toListItem(mapAdminOrder({ ...r, b2b_order_items: [], b2b_order_events: [] }), withItems ? items.length : Number(r.b2b_order_items?.[0]?.count ?? 0)),
          customerNumber: r.b2b_companies?.customer_number ?? undefined,
        }
        if (withItems && items.length) items.forEach((item) => out.push({ order, item }))
        else out.push({ order })
      }
      if (!data?.length || offset >= expected) break
    }
    if (Number.isFinite(expected) && offset < expected) throw new Error('Export unvollständig – bitte erneut versuchen.')
    return out
  }
  await delay()
  const customers = load(K_CUST, ADMIN_CUSTOMERS)
  return load(K_ORDERS, ADMIN_ORDERS)
    .filter((o) => mockOrderMatches(o, q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((o) => {
      const order = { ...toListItem(o, o.items.length), customerNumber: customers.find((c) => c.id === o.companyId)?.customerNumber }
      return withItems && o.items.length ? o.items.map((item) => ({ order, item })) : [{ order }]
    })
}

export async function adminGetOrder(id: string): Promise<AdminOrder | null> {
  if (REAL) {
    const { data, error } = await supabase!.from('b2b_orders').select(ORDER_SELECT).eq('id', id).maybeSingle()
    if (error) throw asError(error)
    return data ? mapAdminOrder(data) : null
  }
  await delay()
  return load(K_ORDERS, ADMIN_ORDERS).find((o) => o.id === id) ?? null
}

export interface NewOrderInput {
  companyId: string
  status: OrderStatus
  /** Visible to the customer in the portal. */
  note?: string
  /** Admin-only (b2b_order_notes). */
  internalNote?: string
  items: Omit<OrderItem, 'id'>[]
  /** Lines with 0 € were explicitly confirmed by the admin. */
  allowZeroPrice?: boolean
  /** Send the order confirmation mail (and, for 'versendet', the shipped mail) to the customer. */
  notifyCustomer?: boolean
  /** Shipping data, only used for status 'versendet'. */
  trackingCarrier?: string
  trackingNumber?: string
  trackingUrl?: string
  invoiceName?: string
  invoiceDataUrl?: string
}

export interface ManualOrderResult {
  order: AdminOrder
  /** Set when the order was created but the attached PDF could not be stored. */
  invoiceError?: string
  /** Set when the order was created but the tracking data could not be stored. */
  trackingError?: string
}

/**
 * Manual back-office order. Order, positions, total and internal note are
 * written atomically by admin_create_order (013); the PDF is uploaded
 * afterwards and only then linked to the order. For status 'versendet' the
 * tracking data is stored next (same columns as the order detail), then the
 * mails go out: confirmation first, then the shipped mail (with tracking).
 */
export async function adminCreateManualOrder(input: NewOrderInput): Promise<ManualOrderResult> {
  const shipped = input.status === 'versendet'
  const tracking = shipped
    ? {
        tracking_carrier: input.trackingCarrier?.trim() || null,
        tracking_number: input.trackingNumber?.trim() || null,
        tracking_url: input.trackingUrl?.trim() || null,
      }
    : null
  if (tracking?.tracking_url && !isHttpsUrl(tracking.tracking_url)) {
    throw new Error('Bitte einen vollständigen https-Link als Tracking-Link eingeben.')
  }
  const hasTracking = !!tracking && Object.values(tracking).some(Boolean)
  if (REAL) {
    const { data: orderId, error } = await supabase!.rpc('admin_create_order', {
      p_company_id: input.companyId,
      p_items: input.items.map((it) => ({
        product_id: it.productId || 'manual',
        product_name: it.productName,
        color: it.color,
        size: it.size,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        print_position: it.printPosition ?? null,
      })),
      p_meta: {
        status: input.status,
        note: input.note ?? null,
        internal_note: input.internalNote ?? null,
        allow_zero_price: !!input.allowZeroPrice,
      },
    })
    if (error) throw asError(error)
    const id = orderId as string

    let invoiceError: string | undefined
    if (input.invoiceDataUrl && input.invoiceName) {
      try {
        const path = await uploadInvoice(input.companyId, id, input.invoiceDataUrl)
        const { error: upErr } = await supabase!.from('b2b_orders').update({ invoice_name: input.invoiceName, invoice_url: path }).eq('id', id)
        if (upErr) throw upErr
      } catch (e) {
        invoiceError = (e as Error)?.message || 'Upload fehlgeschlagen'
      }
    }
    let trackingError: string | undefined
    if (hasTracking) {
      const { error: trErr } = await supabase!.from('b2b_orders').update(tracking!).eq('id', id)
      if (trErr) trackingError = trErr.message || 'Speichern fehlgeschlagen'
    }
    if (input.notifyCustomer) {
      // Sequential, so the confirmation arrives before the shipped mail.
      void sendOrderEmail(id, 'created').then(() => (shipped ? sendOrderEmail(id, 'shipped') : undefined))
    }
    const order = await adminGetOrder(id)
    if (!order) throw new Error('Bestellung angelegt, konnte aber nicht geladen werden.')
    return { order, invoiceError, trackingError }
  }

  await delay(400)
  const items = input.items
  if (!items.length) throw new Error('Mindestens eine Position angeben.')
  if (!input.allowZeroPrice && items.some((it) => !(it.unitPrice > 0))) {
    throw new Error('Position ohne Preis (0 €) – Preis eintragen oder 0 € ausdrücklich bestätigen.')
  }
  const total = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0)
  const orders = load(K_ORDERS, ADMIN_ORDERS)
  const customer = ADMIN_CUSTOMERS.find((c) => c.id === input.companyId) ?? load(K_CUST, ADMIN_CUSTOMERS).find((c) => c.id === input.companyId)
  if (!customer) throw new Error('Kunde nicht gefunden.')
  const seq = 500 + orders.length + 1
  const now = new Date().toISOString()
  const order: AdminOrder = {
    id: `ao_${Date.now()}`,
    companyId: customer.id,
    companyName: customer.company,
    orderNumber: `${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`,
    status: input.status,
    total,
    note: input.note,
    createdAt: now,
    statusHistory: [{ status: input.status, at: now, note: 'Manuell im Backoffice angelegt.' }],
    invoiceName: input.invoiceName,
    invoiceDataUrl: input.invoiceDataUrl,
    trackingCarrier: tracking?.tracking_carrier ?? undefined,
    trackingNumber: tracking?.tracking_number ?? undefined,
    trackingUrl: tracking?.tracking_url ?? undefined,
    items: items.map((it, i) => ({ ...it, id: `aoi_${Date.now()}_${i}` })),
  }
  save(K_ORDERS, [order, ...orders])
  if (input.internalNote) await adminAddNote({ orderId: order.id }, input.internalNote)
  mirrorToCustomerStore(customer.customerNumber, order)
  logAuditMock('bestellung.angelegt', `#${order.orderNumber}`, `Manuell für ${customer.company}`)
  return { order }
}

// Demo bridge (mock only): mirror an order created for the demo customer into
// that customer's local store so it shows up in the account. In real mode both
// sides read the same b2b_orders table, so this is unused.
const DEMO_CUSTOMER_NUMBER = 'B2B-10428'
const CUSTOMER_ORDER_STORE = 'ballina_mock_orders'
function mirrorToCustomerStore(customerNumber: string | undefined, order: AdminOrder) {
  if (customerNumber !== DEMO_CUSTOMER_NUMBER) return
  try {
    const raw = localStorage.getItem(CUSTOMER_ORDER_STORE)
    const list = raw ? (JSON.parse(raw) as unknown[]) : [...MOCK_ORDERS]
    const { companyId: _c, companyName: _n, ...plain } = order
    localStorage.setItem(CUSTOMER_ORDER_STORE, JSON.stringify([plain, ...list]))
  } catch {
    /* ignore */
  }
}

export async function adminAttachInvoice(id: string, name: string, dataUrl: string): Promise<AdminOrder> {
  if (!dataUrl.startsWith('data:application/pdf')) throw new Error('Bitte eine PDF-Datei wählen.')
  if (REAL) {
    const { data: ord, error: e0 } = await supabase!.from('b2b_orders').select('company_id, order_number').eq('id', id).single()
    if (e0) throw asError(e0)
    const path = await uploadInvoice(ord.company_id, id, dataUrl)
    const { error } = await supabase!.from('b2b_orders').update({ invoice_name: name, invoice_url: path }).eq('id', id)
    if (error) throw asError(error)
    await logAuditReal('rechnung.angehängt', `#${ord.order_number}`, name, ord.company_id)
    return (await adminGetOrder(id))!
  }
  await delay(300)
  const orders = load(K_ORDERS, ADMIN_ORDERS)
  const idx = orders.findIndex((o) => o.id === id)
  if (idx < 0) throw new Error('Bestellung nicht gefunden.')
  orders[idx] = { ...orders[idx], invoiceName: name, invoiceDataUrl: dataUrl }
  save(K_ORDERS, orders)
  logAuditMock('rechnung.angehängt', `#${orders[idx].orderNumber}`, name)
  return orders[idx]
}

/**
 * Confirm (and optionally correct) the unit prices of an order whose prices
 * are provisional (price_confirmed = false, see create_order()), then tell the
 * customer by mail (event prices_confirmed, best-effort).
 * `prices` maps order item id → net unit price.
 */
export async function adminConfirmOrderPrices(id: string, prices: Record<string, number>): Promise<AdminOrder> {
  if (REAL) {
    const { error } = await supabase!.rpc('admin_confirm_order_prices', { p_order_id: id, p_prices: prices })
    if (error) throw new Error(error.message)
    void sendOrderEmail(id, 'prices_confirmed')
    return (await adminGetOrder(id))!
  }
  await delay(300)
  const orders = load(K_ORDERS, ADMIN_ORDERS)
  const idx = orders.findIndex((o) => o.id === id)
  if (idx < 0) throw new Error('Bestellung nicht gefunden.')
  const items = orders[idx].items.map((it) => (prices[it.id] !== undefined ? { ...it, unitPrice: prices[it.id] } : it))
  orders[idx] = { ...orders[idx], items, priceConfirmed: true, total: items.reduce((s, it) => s + it.unitPrice * it.quantity, 0) }
  save(K_ORDERS, orders)
  logAuditMock('bestellung.preise_bestaetigt', `#${orders[idx].orderNumber}`, 'Preise bestätigt')
  return orders[idx]
}

export interface OrderUpdate {
  status?: OrderStatus
  note?: string
  trackingCarrier?: string
  trackingNumber?: string
  trackingUrl?: string
}

/**
 * Status / tracking update. Only fields that actually differ are written; the
 * status audit entry and the shipped/cancelled customer mail are triggered
 * only when the status really changes. A changed carrier / tracking number on
 * an order that already is 'versendet' triggers the short tracking_updated
 * mail instead (the function only sends it once the shipped mail went out, and
 * once per distinct tracking data). Re-saving unchanged data sends nothing.
 */
export async function adminUpdateOrder(id: string, patch: OrderUpdate): Promise<AdminOrder> {
  const url = patch.trackingUrl?.trim()
  if (url && !isHttpsUrl(url)) throw new Error('Bitte einen vollständigen https-Link als Tracking-Link eingeben.')
  if (REAL) {
    const { data: cur, error: e0 } = await supabase!
      .from('b2b_orders')
      .select('status, tracking_carrier, tracking_number, tracking_url')
      .eq('id', id)
      .single()
    if (e0) throw asError(e0)
    const row: Record<string, unknown> = {}
    const statusChanged = !!patch.status && patch.status !== cur.status
    if (statusChanged) row.status = patch.status
    const tracking = [
      ['tracking_carrier', patch.trackingCarrier],
      ['tracking_number', patch.trackingNumber],
      ['tracking_url', patch.trackingUrl],
    ] as const
    for (const [col, value] of tracking) {
      if (value === undefined) continue
      const next = value.trim() || null
      if (next !== (cur[col] ?? null)) row[col] = next
    }
    if (!Object.keys(row).length) return (await adminGetOrder(id))!

    let query = supabase!.from('b2b_orders').update(row).eq('id', id)
    // Optimistic guard: a concurrent status change must not be overwritten
    // (and must not trigger a second mail).
    if (statusChanged) query = query.eq('status', cur.status)
    const { data, error } = await query.select('order_number, company_id, status')
    if (error) throw asError(error)
    if (!data?.length) throw new Error('Die Bestellung wurde zwischenzeitlich geändert – bitte Seite neu laden.')
    if (statusChanged) {
      await logAuditReal('bestellung.status', `#${data[0].order_number}`, `Status ${cur.status} → ${patch.status}`, data[0].company_id)
      if (patch.status === 'versendet') void sendOrderEmail(id, 'shipped')
      if (patch.status === 'storniert') void sendOrderEmail(id, 'cancelled')
    } else if (
      data[0].status === 'versendet' &&
      ('tracking_carrier' in row || 'tracking_number' in row) &&
      ('tracking_number' in row ? row.tracking_number : cur.tracking_number)
    ) {
      // Same save as "Versendet" → only the shipped mail above (it carries the tracking data).
      void sendOrderEmail(id, 'tracking_updated')
    }
    return (await adminGetOrder(id))!
  }
  await delay(300)
  const orders = load(K_ORDERS, ADMIN_ORDERS)
  const idx = orders.findIndex((o) => o.id === id)
  if (idx < 0) throw new Error('Bestellung nicht gefunden.')
  const o = orders[idx]
  const next: AdminOrder = { ...o }
  if (patch.trackingCarrier !== undefined) next.trackingCarrier = patch.trackingCarrier.trim() || undefined
  if (patch.trackingNumber !== undefined) next.trackingNumber = patch.trackingNumber.trim() || undefined
  if (patch.trackingUrl !== undefined) next.trackingUrl = patch.trackingUrl.trim() || undefined
  if (patch.status && patch.status !== o.status) {
    next.status = patch.status
    next.statusHistory = [...(o.statusHistory ?? []), { status: patch.status, at: new Date().toISOString(), note: patch.note || undefined }]
  }
  orders[idx] = next
  save(K_ORDERS, orders)
  if (patch.status && patch.status !== o.status) logAuditMock('bestellung.status', `#${o.orderNumber}`, `Status → ${patch.status}`)
  return next
}

/** Reclamation workflow (admin_set_reclamation_status, 013); the note stays internal. */
export async function adminSetReclamationStatus(id: string, status: ReclamationStatus, note?: string): Promise<AdminOrder> {
  if (REAL) {
    const { error } = await supabase!.rpc('admin_set_reclamation_status', {
      p_order_id: id,
      p_status: status,
      p_note: note?.trim() || null,
    })
    if (error) throw asError(error)
    return (await adminGetOrder(id))!
  }
  await delay(300)
  const orders = load(K_ORDERS, ADMIN_ORDERS)
  const idx = orders.findIndex((o) => o.id === id)
  if (idx < 0) throw new Error('Bestellung nicht gefunden.')
  orders[idx] = {
    ...orders[idx],
    reclamationStatus: status,
    reclamationResolvedAt: status === 'erledigt' ? new Date().toISOString() : undefined,
  }
  save(K_ORDERS, orders)
  if (note?.trim()) await adminAddNote({ orderId: id }, `Reklamation: ${note.trim()}`)
  return orders[idx]
}

// ===========================================================================
// Quotes
// ===========================================================================
export type QuoteFilter = QuoteStatus | 'alle'

function mapAdminQuoteListItem(r: any): AdminQuoteListItem {
  const agg = Array.isArray(r.b2b_quote_items) ? r.b2b_quote_items[0] : r.b2b_quote_items
  const q = mapAdminQuote({ ...r, b2b_quote_items: [] })
  const { items: _items, ...rest } = q
  return { ...rest, itemCount: Number(agg?.count ?? 0) }
}

async function expireQuotes() {
  // Housekeeping (also scheduled daily via pg_cron, 011); failures are harmless.
  await supabase!.rpc('expire_quotes').then(
    () => undefined,
    () => undefined,
  )
}

/** Paged quote list, newest first; `search` matches number, title, company or Kd-Nr. */
export async function adminGetQuotesPage(filter: QuoteFilter, search: string, offset: number): Promise<Page<AdminQuoteListItem>> {
  const term = searchTerm(search)
  const limit = QUOTES_PAGE_SIZE
  if (REAL) {
    if (offset === 0) await expireQuotes()
    let query = supabase!
      .from('b2b_quotes')
      .select('*, b2b_quote_items(count), b2b_companies(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)
    if (filter !== 'alle') query = query.eq('status', filter)
    if (term) {
      const ids = await matchingCompanyIds(term)
      const ors = [`quote_number.ilike.*${term}*`, `title.ilike.*${term}*`]
      if (ids.length) ors.push(`company_id.in.(${ids.join(',')})`)
      query = query.or(ors.join(','))
    }
    const { data, error, count } = await query
    if (error) throw asError(error)
    const rows = (data ?? []).map(mapAdminQuoteListItem)
    return { rows, total: count ?? undefined, hasMore: count != null ? offset + rows.length < count : rows.length === limit }
  }
  await delay()
  const t = term.toLowerCase()
  const all = load(K_QUOTES, ADMIN_QUOTES)
    .filter((q) => filter === 'alle' || q.status === filter)
    .filter((q) => !t || [q.quoteNumber, q.title, q.companyName].some((v) => v.toLowerCase().includes(t)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const rows = all.slice(offset, offset + limit).map(({ items, ...q }) => ({ ...q, itemCount: items.length }))
  return { rows, total: all.length, hasMore: offset + rows.length < all.length }
}

export async function adminGetQuoteStatusCounts(): Promise<Record<QuoteStatus, number>> {
  const statuses: QuoteStatus[] = ['offen', 'angenommen', 'abgelehnt', 'abgelaufen']
  if (REAL) {
    // Same housekeeping as the list, so "Offen (n)" never counts expired quotes.
    await expireQuotes()
    const res = await Promise.all(
      statuses.map((st) => supabase!.from('b2b_quotes').select('id', { count: 'exact', head: true }).eq('status', st)),
    )
    const err = res.find((r) => r.error)?.error
    if (err) throw asError(err)
    return Object.fromEntries(statuses.map((st, i) => [st, res[i].count ?? 0])) as Record<QuoteStatus, number>
  }
  const all = load(K_QUOTES, ADMIN_QUOTES)
  return Object.fromEntries(statuses.map((st) => [st, all.filter((q) => q.status === st).length])) as Record<QuoteStatus, number>
}

export async function adminGetQuote(id: string): Promise<AdminQuote | null> {
  if (REAL) {
    const { data, error } = await supabase!.from('b2b_quotes').select(QUOTE_SELECT).eq('id', id).maybeSingle()
    if (error) throw asError(error)
    return data ? mapAdminQuote(data) : null
  }
  await delay()
  return load(K_QUOTES, ADMIN_QUOTES).find((q) => q.id === id) ?? null
}

export interface QuoteInput {
  companyId: string
  title: string
  /** Last valid day (Berlin calendar date, YYYY-MM-DD). */
  validUntil: string
  note?: string
  items: Omit<OrderItem, 'id'>[]
  /** Lines with 0 € were explicitly confirmed by the admin. */
  allowZeroPrice?: boolean
  /** Inquiry this quote answers (set to 'angebot_gesendet' in the same transaction). */
  inquiryId?: string
}

function quoteRpcArgs(input: QuoteInput) {
  return {
    p_items: input.items.map((it) => ({
      product_id: it.productId || 'custom',
      product_name: it.productName,
      color: it.color,
      size: it.size,
      quantity: it.quantity,
      unit_price: it.unitPrice,
    })),
    p_meta: {
      title: input.title,
      valid_until: input.validUntil,
      note: input.note ?? null,
      inquiry_id: input.inquiryId ?? null,
      allow_zero_price: !!input.allowZeroPrice,
    },
  }
}

function mockCheckQuote(input: QuoteInput) {
  if (!input.title.trim()) throw new Error('Bitte einen Titel angeben.')
  if (!YMD.test(input.validUntil) || input.validUntil < new Date().toISOString().slice(0, 10)) {
    throw new Error('„Gültig bis“ liegt in der Vergangenheit.')
  }
  if (!input.allowZeroPrice && input.items.some((it) => !(it.unitPrice > 0))) {
    throw new Error('Position ohne Preis (0 €) – Preis eintragen oder 0 € ausdrücklich bestätigen.')
  }
}

/**
 * New quote via admin_create_quote (013): quote, positions, audit and the
 * answered inquiry's status in one transaction. The customer is notified by
 * mail (event quote_created, best-effort).
 */
export async function adminCreateQuote(input: QuoteInput): Promise<AdminQuote> {
  if (REAL) {
    const { data: quoteId, error } = await supabase!.rpc('admin_create_quote', {
      p_company_id: input.companyId,
      ...quoteRpcArgs(input),
    })
    if (error) throw asError(error)
    void sendPortalMail({ event: 'quote_created', quoteId: quoteId as string })
    const quote = await adminGetQuote(quoteId as string)
    if (!quote) throw new Error('Angebot angelegt, konnte aber nicht geladen werden.')
    return quote
  }
  await delay(400)
  mockCheckQuote(input)
  const total = input.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0)
  const quotes = load(K_QUOTES, ADMIN_QUOTES)
  const customer = load(K_CUST, ADMIN_CUSTOMERS).find((c) => c.id === input.companyId)
  if (!customer) throw new Error('Kunde nicht gefunden.')
  const seq = 88 + quotes.length + 1
  const quote: AdminQuote = {
    id: `aq_${Date.now()}`, companyId: customer.id, companyName: customer.company,
    quoteNumber: `AN-2026-${String(seq).padStart(4, '0')}`, title: input.title,
    createdAt: new Date().toISOString(), validUntil: `${input.validUntil}T21:59:00Z`, status: 'offen', total,
    note: input.note, items: input.items.map((it, i) => ({ ...it, id: `aqi_${Date.now()}_${i}` })),
  }
  save(K_QUOTES, [quote, ...quotes])
  if (input.inquiryId) await adminSetInquiryStatus(input.inquiryId, 'angebot_gesendet')
  logAuditMock('angebot.gesendet', quote.quoteNumber, `An ${quote.companyName}`)
  return quote
}

/** Correct an open quote in place (admin_update_quote, 013). No new mail. */
export async function adminUpdateQuote(id: string, input: QuoteInput): Promise<AdminQuote> {
  if (REAL) {
    const { error } = await supabase!.rpc('admin_update_quote', { p_quote_id: id, ...quoteRpcArgs(input) })
    if (error) throw asError(error)
    return (await adminGetQuote(id))!
  }
  await delay(300)
  mockCheckQuote(input)
  const quotes = load(K_QUOTES, ADMIN_QUOTES)
  const idx = quotes.findIndex((q) => q.id === id)
  if (idx < 0) throw new Error('Angebot nicht gefunden.')
  if (quotes[idx].status !== 'offen') throw new Error('Nur offene Angebote können geändert werden.')
  quotes[idx] = {
    ...quotes[idx],
    title: input.title,
    validUntil: `${input.validUntil}T21:59:00Z`,
    note: input.note,
    items: input.items.map((it, i) => ({ ...it, id: `aqi_${Date.now()}_${i}` })),
    total: input.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0),
  }
  save(K_QUOTES, quotes)
  logAuditMock('angebot.geaendert', quotes[idx].quoteNumber, 'Angebot korrigiert')
  return quotes[idx]
}

/** Withdraw an open quote (admin_withdraw_quote, 013): it can no longer be accepted. */
export async function adminWithdrawQuote(id: string): Promise<AdminQuote> {
  if (REAL) {
    const { error } = await supabase!.rpc('admin_withdraw_quote', { p_quote_id: id })
    if (error) throw asError(error)
    return (await adminGetQuote(id))!
  }
  await delay(300)
  const quotes = load(K_QUOTES, ADMIN_QUOTES)
  const idx = quotes.findIndex((q) => q.id === id)
  if (idx < 0 || quotes[idx].status !== 'offen') throw new Error('Nur offene Angebote können zurückgezogen werden.')
  const now = new Date().toISOString()
  quotes[idx] = { ...quotes[idx], status: 'abgelaufen', withdrawnAt: now, validUntil: now }
  save(K_QUOTES, quotes)
  logAuditMock('angebot.zurueckgezogen', quotes[idx].quoteNumber, 'Angebot zurückgezogen')
  return quotes[idx]
}

// ===========================================================================
// Inquiries
// ===========================================================================
/** 'offen' = new or in progress (default view). */
export type InquiryFilter = 'offen' | AdminInquiry['status'] | 'alle'

const INQUIRY_SELECT = '*, b2b_companies(name, b2b_profiles(phone))'

function mapInquiry(r: any): AdminInquiry {
  const prof = r.b2b_companies?.b2b_profiles
  const phone = (Array.isArray(prof) ? prof[0] : prof)?.phone
  return {
    id: r.id,
    companyId: r.company_id ?? '',
    companyName: r.b2b_companies?.name ?? '—',
    contactPerson: r.contact_person ?? '',
    email: r.email ?? '',
    phone: phone ?? undefined,
    productType: r.product_type,
    quantity: r.quantity ?? 0,
    deadline: r.deadline ?? undefined,
    message: r.message ?? undefined,
    artworkName: r.artwork_name ?? undefined,
    artworkPath: r.artwork_path ?? undefined,
    status: r.status,
    createdAt: r.created_at,
  }
}

function inquiryStatuses(filter: InquiryFilter): AdminInquiry['status'][] | null {
  if (filter === 'alle') return null
  return filter === 'offen' ? ['neu', 'in_bearbeitung'] : [filter]
}

/** Paged inquiries, newest first. */
export async function adminGetInquiriesPage(filter: InquiryFilter, offset: number): Promise<Page<AdminInquiry>> {
  const limit = INQUIRIES_PAGE_SIZE
  const statuses = inquiryStatuses(filter)
  if (REAL) {
    let query = supabase!
      .from('b2b_inquiries')
      .select(INQUIRY_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)
    if (statuses) query = query.in('status', statuses)
    const { data, error, count } = await query
    if (error) throw asError(error)
    const rows = (data ?? []).map(mapInquiry)
    return { rows, total: count ?? undefined, hasMore: count != null ? offset + rows.length < count : rows.length === limit }
  }
  await delay()
  const all = load(K_INQ, ADMIN_INQUIRIES)
    .filter((i) => !statuses || statuses.includes(i.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const rows = all.slice(offset, offset + limit)
  return { rows, total: all.length, hasMore: offset + rows.length < all.length }
}

export async function adminGetInquiryCounts(): Promise<Record<Exclude<InquiryFilter, 'alle'>, number>> {
  const keys: Exclude<InquiryFilter, 'alle'>[] = ['offen', 'neu', 'in_bearbeitung', 'angebot_gesendet', 'abgeschlossen']
  if (REAL) {
    const res = await Promise.all(
      keys.map((k) => supabase!.from('b2b_inquiries').select('id', { count: 'exact', head: true }).in('status', inquiryStatuses(k)!)),
    )
    const err = res.find((r) => r.error)?.error
    if (err) throw asError(err)
    return Object.fromEntries(keys.map((k, i) => [k, res[i].count ?? 0])) as Record<Exclude<InquiryFilter, 'alle'>, number>
  }
  const all = load(K_INQ, ADMIN_INQUIRIES)
  return Object.fromEntries(keys.map((k) => [k, all.filter((i) => inquiryStatuses(k)!.includes(i.status)).length])) as Record<Exclude<InquiryFilter, 'alle'>, number>
}

export async function adminGetInquiry(id: string): Promise<AdminInquiry | null> {
  if (REAL) {
    const { data, error } = await supabase!.from('b2b_inquiries').select(INQUIRY_SELECT).eq('id', id).maybeSingle()
    if (error) throw asError(error)
    return data ? mapInquiry(data) : null
  }
  await delay()
  return load(K_INQ, ADMIN_INQUIRIES).find((i) => i.id === id) ?? null
}

export async function adminSetInquiryStatus(id: string, status: AdminInquiry['status']): Promise<void> {
  if (REAL) {
    const { error } = await supabase!.from('b2b_inquiries').update({ status }).eq('id', id)
    if (error) throw asError(error)
    return
  }
  await delay()
  const list = load(K_INQ, ADMIN_INQUIRIES)
  save(K_INQ, list.map((i) => (i.id === id ? { ...i, status } : i)))
}

// ===========================================================================
// Dashboard stats
// ===========================================================================
export interface AdminStats {
  /** Berlin calendar year of orderValueYear / ordersYear. */
  year: number
  customers: number
  openOrders: number
  inProduction: number
  /** Non-cancelled orders whose prices still need confirmation. */
  unconfirmedOrders: number
  openReclamations: number
  /**
   * Net goods + net shipping of non-cancelled orders with confirmed prices
   * placed this year; undefined if the server-side RPC (013) is missing.
   */
  orderValueYear?: number
  ordersYear?: number
  openInquiries: number
  openQuotes: number
}

/** Dashboard + sidebar badges. Computed in SQL (admin_dashboard_stats, 013); throws on errors. */
export async function adminGetStats(): Promise<AdminStats> {
  if (REAL) {
    const rpc = await supabase!.rpc('admin_dashboard_stats')
    if (!rpc.error) {
      const s = rpc.data as Record<string, number>
      return {
        year: Number(s.year),
        customers: Number(s.customers ?? 0),
        openOrders: Number(s.open_orders ?? 0),
        inProduction: Number(s.in_production ?? 0),
        unconfirmedOrders: Number(s.unconfirmed_orders ?? 0),
        openReclamations: Number(s.open_reclamations ?? 0),
        orderValueYear: Number(s.order_value_year ?? 0),
        ordersYear: Number(s.orders_year ?? 0),
        openInquiries: Number(s.open_inquiries ?? 0),
        openQuotes: Number(s.open_quotes ?? 0),
      }
    }
    // PGRST202 = function not found (013 not applied yet) → head-only counts, no order value.
    if (rpc.error.code !== 'PGRST202') throw asError(rpc.error)
    const head = (table: string) => supabase!.from(table).select('id', { count: 'exact', head: true })
    const res = await Promise.all([
      head('b2b_companies'),
      head('b2b_orders').eq('status', 'offen'),
      head('b2b_orders').eq('status', 'in_bearbeitung'),
      head('b2b_orders').eq('price_confirmed', false).neq('status', 'storniert'),
      head('b2b_orders').not('reclamation', 'is', null),
      head('b2b_inquiries').eq('status', 'neu'),
      head('b2b_quotes').eq('status', 'offen'),
    ])
    const err = res.find((r) => r.error)?.error
    if (err) throw asError(err)
    const [customers, openOrders, inProduction, unconfirmedOrders, openReclamations, openInquiries, openQuotes] = res.map((r) => r.count ?? 0)
    return { year: berlinYear(), customers, openOrders, inProduction, unconfirmedOrders, openReclamations, openInquiries, openQuotes }
  }
  await delay()
  const orders = load(K_ORDERS, ADMIN_ORDERS)
  const inquiries = load(K_INQ, ADMIN_INQUIRIES)
  const quotes = load(K_QUOTES, ADMIN_QUOTES)
  const year = berlinYear()
  const counted = orders.filter((o) => o.status !== 'storniert' && o.priceConfirmed !== false && berlinYear(new Date(o.createdAt)) === year)
  return {
    year,
    customers: load(K_CUST, ADMIN_CUSTOMERS).length,
    openOrders: orders.filter((o) => o.status === 'offen').length,
    inProduction: orders.filter((o) => o.status === 'in_bearbeitung').length,
    unconfirmedOrders: orders.filter((o) => o.priceConfirmed === false && o.status !== 'storniert').length,
    openReclamations: orders.filter((o) => o.reclamation && o.reclamationStatus !== 'erledigt').length,
    orderValueYear: counted.reduce((s, o) => s + o.total + (o.shipping ?? 0), 0),
    ordersYear: counted.length,
    openInquiries: inquiries.filter((i) => i.status === 'neu').length,
    openQuotes: quotes.filter((q) => q.status === 'offen').length,
  }
}
