import { supabase, USE_MOCK } from './supabase'
import { uploadInvoice } from './invoices'
import { ADMIN_CUSTOMERS, ADMIN_INQUIRIES, ADMIN_ORDERS, ADMIN_QUOTES } from './adminMock'
import { MOCK_ORDERS } from './mockData'
import type {
  AdminInquiry,
  AdminOrder,
  AdminQuote,
  AuditEntry,
  Company,
  OrderItem,
  OrderStatus,
} from './types'

const REAL = !USE_MOCK && !!supabase
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms))

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
    if (patch.annualBudget !== undefined) row.annual_budget = patch.annualBudget ?? null
    if (patch.paymentTerms !== undefined) row.payment_terms = patch.paymentTerms
    if (patch.company !== undefined) row.name = patch.company
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
    const { count } = await supabase!.from('b2b_companies').select('id', { count: 'exact', head: true })
    const num = 10700 + (count ?? 0)
    const { data, error } = await supabase!
      .from('b2b_companies')
      .insert({
        name: input.company,
        customer_number: `B2B-${num}`,
        discount_percent: input.discountPercent ?? 0,
        annual_budget: input.annualBudget ?? null,
        payment_terms: input.paymentTerms ?? '14 Tage netto',
      })
      .select('*')
      .single()
    if (error) throw error
    await logAuditReal('kunde.angelegt', data.name, `Neukunde ${data.customer_number}`, data.id)
    // Create the login account + send invite via the serverless function
    // (uses service_role; a browser cannot create auth users safely). Best-effort:
    // the company exists regardless; the invite works once the function is deployed.
    try {
      const { data: sess } = await supabase!.auth.getSession()
      const token = sess.session?.access_token
      if (token) {
        const res = await fetch('/api/admin-create-user', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: data.id, email: input.email, name: input.contactPerson, phone: input.phone }),
        })
        if (!res.ok) console.warn('[admin] Invite fehlgeschlagen:', await res.text())
      }
    } catch (e) {
      console.warn('[admin] Invite-Function nicht erreichbar (Deploy nötig):', e)
    }
    return mapCompany(data)
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
export async function adminGetAudit(): Promise<AuditEntry[]> {
  if (REAL) {
    const { data, error } = await supabase!
      .from('b2b_audit_log')
      .select('*')
      .order('at', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []).map((r: any) => ({
      id: String(r.id),
      at: r.at,
      actor: r.actor ?? '—',
      action: r.action,
      entity: r.entity ?? '',
      detail: r.meta?.detail ?? '',
    }))
  }
  await delay()
  const live = load<AuditEntry>(K_AUDIT, [])
  return [...live, ...AUDIT_SEED].sort((a, b) => b.at.localeCompare(a.at))
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
    orderNumber: `2026-${String(seq).padStart(4, '0')}`,
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
    const { count } = await supabase!.from('b2b_quotes').select('id', { count: 'exact', head: true })
    const quoteNumber = `AN-2026-${String(89 + (count ?? 0)).padStart(4, '0')}`
    const { data: q, error } = await supabase!
      .from('b2b_quotes')
      .insert({ company_id: input.companyId, quote_number: quoteNumber, title: input.title, status: 'offen', total, note: input.note, valid_until: input.validUntil })
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
