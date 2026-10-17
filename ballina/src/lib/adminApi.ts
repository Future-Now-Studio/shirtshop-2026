import { supabase, USE_MOCK } from './supabase'
import { uploadInvoice } from './invoices'
import { ADMIN_CUSTOMERS, ADMIN_INQUIRIES, ADMIN_ORDERS, ADMIN_QUOTES } from './adminMock'
import { MOCK_ORDERS } from './mockData'
import { sendOrderEmail } from './api'
import { berlinYearRange, budgetSpent } from './utils'
import type {
  AdminInquiry,
  AdminOrder,
  AdminOrderListItem,
  AdminQuote,
  AuditEntry,
  Page,
  Company,
  OrderItem,
  OrderStatus,
} from './types'

const REAL = !USE_MOCK && !!supabase
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms))

/** Page sizes for the "Mehr laden" lists. */
export const ORDERS_PAGE_SIZE = 50
export const CUSTOMERS_PAGE_SIZE = 50
export const AUDIT_PAGE_SIZE = 100

/**
 * Make free text safe for a PostgREST `or=(…)` ilike filter: drop the
 * characters that carry syntax there (, . ( ) " \ * %) and collapse spaces.
 */
function searchTerm(raw: string): string {
  return raw.replace(/[,.()"\\*%:#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
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

// ===========================================================================
// Customers
// ===========================================================================
export async function adminGetCustomers(): Promise<Company[]> {
  if (REAL) {
    const { data, error } = await supabase!
      .from('b2b_companies')
      .select('*, b2b_profiles(name,email,phone)')
      .order('name')
    if (error) throw error
    return (data ?? []).map(mapCompany)
  }
  await delay()
  return load(K_CUST, ADMIN_CUSTOMERS)
}

/** Paged + server-side searched customer list (Kunden page). */
export async function adminGetCustomersPage(search: string, offset: number): Promise<Page<Company>> {
  const term = searchTerm(search)
  const limit = CUSTOMERS_PAGE_SIZE
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
      .single()
    if (error) throw error
    return data ? mapCompany(data) : null
  }
  await delay()
  return load(K_CUST, ADMIN_CUSTOMERS).find((c) => c.id === id) ?? null
}

export async function adminUpdateCustomer(id: string, patch: Partial<Company>): Promise<Company> {
  if (REAL) {
    const row: Record<string, unknown> = {}
    if (patch.discountPercent !== undefined) row.discount_percent = patch.discountPercent
    // An explicit `annualBudget: undefined` clears the budget.
    if ('annualBudget' in patch) row.annual_budget = patch.annualBudget ?? null
    if (patch.paymentTerms !== undefined) row.payment_terms = patch.paymentTerms
    if (patch.company !== undefined) row.name = patch.company
    if (patch.vatId !== undefined) row.vat_id = patch.vatId || null
    for (const [key, prefix] of [['billingAddress', 'billing'], ['deliveryAddress', 'delivery']] as const) {
      const a = patch[key]
      if (a === undefined) continue
      row[`${prefix}_line1`] = a?.line1 || null
      row[`${prefix}_zip`] = a?.zip || null
      row[`${prefix}_city`] = a?.city || null
      row[`${prefix}_country`] = a?.country || 'DE'
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
    let inviteError: string | null = null
    try {
      const { data: sess } = await supabase!.auth.getSession()
      const token = sess.session?.access_token
      if (!token) {
        inviteError = 'Keine gültige Sitzung – bitte neu anmelden.'
      } else {
        const res = await fetch('/api/admin-create-user', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: data.id, email: input.email, name: input.contactPerson, phone: input.phone }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          inviteError = body?.error ?? `HTTP ${res.status}`
        }
      }
    } catch {
      inviteError = 'Invite-Function nicht erreichbar (ist sie auf Netlify deployed?).'
    }
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
export async function adminGetOrders(): Promise<AdminOrder[]> {
  if (REAL) {
    const { data, error } = await supabase!.from('b2b_orders').select(ORDER_SELECT).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(mapAdminOrder)
  }
  await delay()
  return load(K_ORDERS, ADMIN_ORDERS).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export type OrderFilter = OrderStatus | 'alle'

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

/**
 * Paged back-office order list, newest first. `search` matches the order
 * number or the company name. Items are only counted, not loaded.
 */
export async function adminGetOrdersPage(
  filter: OrderFilter,
  search: string,
  offset: number,
): Promise<Page<AdminOrderListItem>> {
  const term = searchTerm(search)
  const limit = ORDERS_PAGE_SIZE
  if (REAL) {
    let query = supabase!
      .from('b2b_orders')
      .select('*, b2b_order_items(count), b2b_companies(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)
    if (filter !== 'alle') query = query.eq('status', filter)
    if (term) {
      const { data: comps, error: cErr } = await supabase!
        .from('b2b_companies')
        .select('id')
        .ilike('name', `%${term}%`)
        .limit(200)
      if (cErr) throw cErr
      const ors = [`order_number.ilike.*${term}*`]
      const ids = (comps ?? []).map((c: any) => c.id as string)
      if (ids.length) ors.push(`company_id.in.(${ids.join(',')})`)
      query = query.or(ors.join(','))
    }
    const { data, error, count } = await query
    if (error) throw error
    const rows = (data ?? []).map(mapAdminOrderListItem)
    return { rows, total: count ?? undefined, hasMore: count != null ? offset + rows.length < count : rows.length === limit }
  }
  await delay()
  const t = term.toLowerCase().replace(/^#/, '')
  const all = load(K_ORDERS, ADMIN_ORDERS)
    .filter((o) => filter === 'alle' || o.status === filter)
    .filter((o) => !t || o.orderNumber.toLowerCase().includes(t) || o.companyName.toLowerCase().includes(t))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const rows = all.slice(offset, offset + limit).map((o) => toListItem(o, o.items.length))
  return { rows, total: all.length, hasMore: offset + rows.length < all.length }
}

/** Number of orders per status (for the filter chips) — head-only count queries. */
export async function adminGetOrderStatusCounts(): Promise<Record<OrderStatus, number>> {
  const statuses: OrderStatus[] = ['offen', 'in_bearbeitung', 'versendet', 'abgeschlossen', 'storniert']
  if (REAL) {
    const res = await Promise.all(
      statuses.map((st) => supabase!.from('b2b_orders').select('id', { count: 'exact', head: true }).eq('status', st)),
    )
    const err = res.find((r) => r.error)?.error
    if (err) throw err
    return Object.fromEntries(statuses.map((st, i) => [st, res[i].count ?? 0])) as Record<OrderStatus, number>
  }
  const all = load(K_ORDERS, ADMIN_ORDERS)
  return Object.fromEntries(statuses.map((st) => [st, all.filter((o) => o.status === st).length])) as Record<OrderStatus, number>
}

export async function adminGetOrder(id: string): Promise<AdminOrder | null> {
  if (REAL) {
    const { data, error } = await supabase!.from('b2b_orders').select(ORDER_SELECT).eq('id', id).single()
    if (error) throw error
    return data ? mapAdminOrder(data) : null
  }
  await delay()
  return load(K_ORDERS, ADMIN_ORDERS).find((o) => o.id === id) ?? null
}

export interface NewOrderInput {
  companyId: string
  status: OrderStatus
  note?: string
  items: Omit<OrderItem, 'id'>[]
  invoiceName?: string
  invoiceDataUrl?: string
}
export async function adminCreateManualOrder(input: NewOrderInput): Promise<AdminOrder> {
  const total = input.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0)
  if (REAL) {
    const { data: { user } } = await supabase!.auth.getUser()
    const { data: orderRow, error } = await supabase!
      .from('b2b_orders')
      .insert({
        company_id: input.companyId,
        created_by: user?.id ?? null,
        status: input.status,
        total,
        note: input.note,
        invoice_name: input.invoiceName ?? null,
      })
      .select('id, order_number, company_id')
      .single()
    if (error) throw error
    if (input.invoiceDataUrl) {
      const path = await uploadInvoice(input.companyId, orderRow.id, input.invoiceDataUrl)
      await supabase!.from('b2b_orders').update({ invoice_url: path }).eq('id', orderRow.id)
    }
    const itemRows = input.items.map((it) => ({
      order_id: orderRow.id,
      product_id: it.productId,
      product_name: it.productName,
      image_url: it.imageUrl,
      color: it.color,
      size: it.size,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      print_position: it.printPosition ?? null,
      artwork_name: it.artworkName ?? null,
    }))
    const { error: itemsErr } = await supabase!.from('b2b_order_items').insert(itemRows)
    if (itemsErr) throw itemsErr
    await logAuditReal('bestellung.angelegt', `#${orderRow.order_number}`, 'Manuell im Backoffice', input.companyId)
    return (await adminGetOrder(orderRow.id))!
  }

  await delay(400)
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
    items: input.items.map((it, i) => ({ ...it, id: `aoi_${Date.now()}_${i}` })),
  }
  save(K_ORDERS, [order, ...orders])
  mirrorToCustomerStore(customer.customerNumber, order)
  logAuditMock('bestellung.angelegt', `#${order.orderNumber}`, `Manuell für ${customer.company}`)
  return order
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
  if (REAL) {
    const { data: ord, error: e0 } = await supabase!.from('b2b_orders').select('company_id, order_number').eq('id', id).single()
    if (e0) throw e0
    const path = await uploadInvoice(ord.company_id, id, dataUrl)
    const { error } = await supabase!.from('b2b_orders').update({ invoice_name: name, invoice_url: path }).eq('id', id)
    if (error) throw error
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
 * are provisional (price_confirmed = false, see create_order()).
 * `prices` maps order item id → net unit price.
 */
export async function adminConfirmOrderPrices(id: string, prices: Record<string, number>): Promise<AdminOrder> {
  if (REAL) {
    const { error } = await supabase!.rpc('admin_confirm_order_prices', { p_order_id: id, p_prices: prices })
    if (error) throw new Error(error.message)
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
export async function adminUpdateOrder(id: string, patch: OrderUpdate): Promise<AdminOrder> {
  if (REAL) {
    const row: Record<string, unknown> = {}
    if (patch.status) row.status = patch.status
    if (patch.trackingCarrier !== undefined) row.tracking_carrier = patch.trackingCarrier || null
    if (patch.trackingNumber !== undefined) row.tracking_number = patch.trackingNumber || null
    if (patch.trackingUrl !== undefined) row.tracking_url = patch.trackingUrl || null
    const { data, error } = await supabase!.from('b2b_orders').update(row).eq('id', id).select('order_number, company_id, status').single()
    if (error) throw error
    if (patch.status) await logAuditReal('bestellung.status', `#${data.order_number}`, `Status → ${patch.status}`, data.company_id)
    if (patch.status === 'versendet' || patch.status === 'storniert') {
      void sendOrderEmail(id, patch.status === 'versendet' ? 'shipped' : 'cancelled')
    }
    return (await adminGetOrder(id))!
  }
  await delay(300)
  const orders = load(K_ORDERS, ADMIN_ORDERS)
  const idx = orders.findIndex((o) => o.id === id)
  if (idx < 0) throw new Error('Bestellung nicht gefunden.')
  const o = orders[idx]
  const next: AdminOrder = { ...o }
  if (patch.trackingCarrier !== undefined) next.trackingCarrier = patch.trackingCarrier || undefined
  if (patch.trackingNumber !== undefined) next.trackingNumber = patch.trackingNumber || undefined
  if (patch.trackingUrl !== undefined) next.trackingUrl = patch.trackingUrl || undefined
  if (patch.status && patch.status !== o.status) {
    next.status = patch.status
    next.statusHistory = [...(o.statusHistory ?? []), { status: patch.status, at: new Date().toISOString(), note: patch.note || undefined }]
  }
  orders[idx] = next
  save(K_ORDERS, orders)
  if (patch.status && patch.status !== o.status) logAuditMock('bestellung.status', `#${o.orderNumber}`, `Status → ${patch.status}`)
  return next
}

// ===========================================================================
// Quotes
// ===========================================================================
export async function adminGetQuotes(): Promise<AdminQuote[]> {
  if (REAL) {
    await supabase!.rpc('expire_quotes').then(
      () => undefined,
      () => undefined,
    )
    const { data, error } = await supabase!.from('b2b_quotes').select(QUOTE_SELECT).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(mapAdminQuote)
  }
  await delay()
  return load(K_QUOTES, ADMIN_QUOTES).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function adminGetQuote(id: string): Promise<AdminQuote | null> {
  if (REAL) {
    const { data, error } = await supabase!.from('b2b_quotes').select(QUOTE_SELECT).eq('id', id).single()
    if (error) throw error
    return data ? mapAdminQuote(data) : null
  }
  await delay()
  return load(K_QUOTES, ADMIN_QUOTES).find((q) => q.id === id) ?? null
}

export interface NewQuoteInput {
  companyId: string
  title: string
  validUntil: string
  note?: string
  items: Omit<OrderItem, 'id'>[]
}
export async function adminCreateQuote(input: NewQuoteInput): Promise<AdminQuote> {
  const total = input.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0)
  if (REAL) {
    // quote_number comes from the DB sequence (b2b_quote_seq).
    const { data: q, error } = await supabase!
      .from('b2b_quotes')
      .insert({ company_id: input.companyId, title: input.title, status: 'offen', total, note: input.note, valid_until: input.validUntil })
      .select('id, quote_number')
      .single()
    if (error) throw error
    const itemRows = input.items.map((it) => ({
      quote_id: q.id, product_id: it.productId, product_name: it.productName, image_url: it.imageUrl,
      color: it.color, size: it.size, quantity: it.quantity, unit_price: it.unitPrice,
    }))
    const { error: iErr } = await supabase!.from('b2b_quote_items').insert(itemRows)
    if (iErr) throw iErr
    await logAuditReal('angebot.gesendet', q.quote_number, 'Neues Angebot', input.companyId)
    return (await adminGetQuote(q.id))!
  }
  await delay(400)
  const quotes = load(K_QUOTES, ADMIN_QUOTES)
  const customer = ADMIN_CUSTOMERS.find((c) => c.id === input.companyId)
  if (!customer) throw new Error('Kunde nicht gefunden.')
  const seq = 88 + quotes.length + 1
  const quote: AdminQuote = {
    id: `aq_${Date.now()}`, companyId: customer.id, companyName: customer.company,
    quoteNumber: `AN-2026-${String(seq).padStart(4, '0')}`, title: input.title,
    createdAt: new Date().toISOString(), validUntil: input.validUntil, status: 'offen', total,
    note: input.note, items: input.items.map((it, i) => ({ ...it, id: `aqi_${Date.now()}_${i}` })),
  }
  save(K_QUOTES, [quote, ...quotes])
  logAuditMock('angebot.gesendet', quote.quoteNumber, `An ${quote.companyName}`)
  return quote
}

// ===========================================================================
// Inquiries
// ===========================================================================
export async function adminGetInquiries(): Promise<AdminInquiry[]> {
  if (REAL) {
    const { data, error } = await supabase!
      .from('b2b_inquiries')
      .select('*, b2b_companies(name)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r: any) => ({
      id: r.id,
      companyId: r.company_id ?? '',
      companyName: r.b2b_companies?.name ?? '—',
      contactPerson: r.contact_person ?? '',
      email: r.email ?? '',
      productType: r.product_type,
      quantity: r.quantity ?? 0,
      deadline: r.deadline ?? undefined,
      message: r.message ?? undefined,
      artworkName: r.artwork_name ?? undefined,
      artworkPath: r.artwork_path ?? undefined,
      status: r.status,
      createdAt: r.created_at,
    }))
  }
  await delay()
  return load(K_INQ, ADMIN_INQUIRIES).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
export async function adminSetInquiryStatus(id: string, status: AdminInquiry['status']): Promise<void> {
  if (REAL) {
    const { error } = await supabase!.from('b2b_inquiries').update({ status }).eq('id', id)
    if (error) throw error
    return
  }
  await delay()
  const list = load(K_INQ, ADMIN_INQUIRIES)
  save(K_INQ, list.map((i) => (i.id === id ? { ...i, status } : i)))
}

// ===========================================================================
// Dashboard stats
// ===========================================================================
export async function adminGetStats() {
  if (REAL) {
    const [orders, quotes, inquiries, customers] = await Promise.all([
      supabase!.from('b2b_orders').select('status, total'),
      supabase!.from('b2b_quotes').select('status'),
      supabase!.from('b2b_inquiries').select('status'),
      supabase!.from('b2b_companies').select('id', { count: 'exact', head: true }),
    ])
    const o = orders.data ?? []
    return {
      customers: customers.count ?? 0,
      openOrders: o.filter((x: any) => x.status === 'offen').length,
      inProduction: o.filter((x: any) => x.status === 'in_bearbeitung').length,
      revenue: o.filter((x: any) => x.status !== 'storniert').reduce((s: number, x: any) => s + Number(x.total ?? 0), 0),
      openInquiries: (inquiries.data ?? []).filter((x: any) => x.status === 'neu').length,
      openQuotes: (quotes.data ?? []).filter((x: any) => x.status === 'offen').length,
    }
  }
  await delay()
  const orders = load(K_ORDERS, ADMIN_ORDERS)
  const inquiries = load(K_INQ, ADMIN_INQUIRIES)
  const quotes = load(K_QUOTES, ADMIN_QUOTES)
  return {
    customers: ADMIN_CUSTOMERS.length,
    openOrders: orders.filter((o) => o.status === 'offen').length,
    inProduction: orders.filter((o) => o.status === 'in_bearbeitung').length,
    revenue: orders.filter((o) => o.status !== 'storniert').reduce((s, o) => s + o.total, 0),
    openInquiries: inquiries.filter((i) => i.status === 'neu').length,
    openQuotes: quotes.filter((q) => q.status === 'offen').length,
  }
}
