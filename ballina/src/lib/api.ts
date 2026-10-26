import { uploadArtwork } from './artwork'
import { supabase, USE_MOCK } from './supabase'
import { MOCK_COMPANY, MOCK_ORDERS, MOCK_QUOTES } from './mockData'
import { isQuoteAcceptable } from './utils'
import type {
  Address,
  CartLine,
  Company,
  Inquiry,
  Order,
  Quote,
  QuoteStatus,
} from './types'

// ---------------------------------------------------------------------------
// Local (mock) store — keeps created orders alive across navigation via
// localStorage, so the whole flow feels real without a backend.
// ---------------------------------------------------------------------------
const LS_ORDERS = 'ballina_mock_orders'

function loadMockOrders(): Order[] {
  try {
    const raw = localStorage.getItem(LS_ORDERS)
    if (raw) return JSON.parse(raw) as Order[]
  } catch {
    /* ignore */
  }
  return [...MOCK_ORDERS]
}

function saveMockOrders(orders: Order[]) {
  try {
    localStorage.setItem(LS_ORDERS, JSON.stringify(orders))
  } catch {
    /* ignore */
  }
}

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms))

function nextOrderNumber(orders: Order[]): string {
  const year = new Date().getFullYear()
  const maxSeq = orders
    .map((o) => parseInt(o.orderNumber.split('-')[1] ?? '0', 10))
    .reduce((a, b) => Math.max(a, b), 500)
  return `${year}-${String(maxSeq + 1).padStart(4, '0')}`
}

// ---------------------------------------------------------------------------
// Public API — pages/hooks call these regardless of backend.
// ---------------------------------------------------------------------------
export async function getCompany(): Promise<Company> {
  if (USE_MOCK || !supabase) {
    await delay()
    return MOCK_COMPANY
  }
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('b2b_profiles')
    .select('name, email, phone')
    .eq('user_id', user?.id)
    .single()
  // RLS returns only the caller's own company row.
  const { data: comp, error } = await supabase.from('b2b_companies').select('*').single()
  if (error) throw error
  const billing = comp.billing_line1
    ? { line1: comp.billing_line1, zip: comp.billing_zip ?? '', city: comp.billing_city ?? '', country: comp.billing_country ?? undefined }
    : undefined
  const delivery = comp.delivery_line1
    ? { line1: comp.delivery_line1, zip: comp.delivery_zip ?? '', city: comp.delivery_city ?? '', country: comp.delivery_country ?? undefined }
    : undefined
  return {
    id: comp.id,
    company: comp.name,
    contactPerson: profile?.name ?? '',
    email: profile?.email ?? user?.email ?? '',
    phone: profile?.phone ?? undefined,
    customerNumber: comp.customer_number ?? undefined,
    vatId: comp.vat_id ?? undefined,
    billingAddress: billing,
    deliveryAddress: delivery,
    paymentTerms: comp.payment_terms ?? undefined,
    // discount_percent is an internal guide value for quotes (never applied to
    // prices), so the customer app does not load it.
    annualBudget: comp.annual_budget != null ? Number(comp.annual_budget) : undefined,
  }
}

export async function getOrders(): Promise<Order[]> {
  if (USE_MOCK || !supabase) {
    await delay()
    return loadMockOrders().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  // RLS scopes rows to the caller's company automatically.
  const { data, error } = await supabase
    .from('b2b_orders')
    .select('*, b2b_order_items(*), b2b_order_events(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapOrderRow)
}

export async function getOrder(id: string): Promise<Order | null> {
  if (USE_MOCK || !supabase) {
    await delay()
    return loadMockOrders().find((o) => o.id === id) ?? null
  }
  // maybeSingle: an unknown / foreign id is "not found" (null), not an error.
  const { data, error } = await supabase
    .from('b2b_orders')
    .select('*, b2b_order_items(*), b2b_order_events(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapOrderRow(data) : null
}

/** Order details entered in the order / accept dialog (stored in columns, see 012). */
export interface OrderMeta {
  note?: string
  poNumber?: string // Bestellzeichen / Kostenstelle
  deliveryAddress?: Address // undefined → company default
  requestedDate?: string // YYYY-MM-DD
}

function metaToRpc(meta: OrderMeta) {
  return {
    note: meta.note?.trim() || null,
    po_number: meta.poNumber?.trim() || null,
    requested_date: meta.requestedDate || null,
    delivery_address: meta.deliveryAddress
      ? {
          name: meta.deliveryAddress.name?.trim() || null,
          line1: meta.deliveryAddress.line1.trim(),
          zip: meta.deliveryAddress.zip.trim(),
          city: meta.deliveryAddress.city.trim(),
          country: meta.deliveryAddress.country?.trim() || null,
        }
      : null,
  }
}

export async function createOrder(lines: CartLine[], meta: OrderMeta = {}): Promise<Order> {
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)

  if (USE_MOCK || !supabase) {
    await delay(400)
    const orders = loadMockOrders()
    const now = new Date().toISOString()
    const order: Order = {
      id: `o_${Date.now()}`,
      orderNumber: nextOrderNumber(orders),
      status: 'offen',
      total,
      note: meta.note?.trim() || undefined,
      poNumber: meta.poNumber?.trim() || undefined,
      deliveryAddress: meta.deliveryAddress,
      requestedDate: meta.requestedDate || undefined,
      createdAt: now,
      statusHistory: [{ status: 'offen', at: now, note: 'Bestellung eingegangen.' }],
      items: lines.map((l, idx) => ({ id: `i_${Date.now()}_${idx}`, ...l })),
    }
    saveMockOrders([order, ...orders])
    return order
  }

  // Upload attached print files first (private bucket, own company folder).
  // Work on copies: the caller's lines are UI state.
  const items = lines.map((l) => ({ ...l }))
  if (items.some((l) => l.artworkFile)) {
    const profile = await currentProfile()
    if (!profile) throw new Error('Kein Firmenprofil gefunden.')
    for (const l of items) {
      if (l.artworkFile) l.artworkPath = await uploadArtwork(profile.companyId, l.artworkFile)
    }
  }

  // Server-side RPC: validates the company, derives unit prices and images
  // from the DB (never from the client) and computes the total. See 012.
  const { data: orderId, error } = await supabase.rpc('create_order', {
    p_items: items.map((l) => ({
      product_id: l.productId,
      product_name: l.productName,
      color: l.color,
      size: l.size,
      quantity: l.quantity,
      print_position: l.printPosition ?? null,
      artwork_name: l.artworkName ?? null,
      artwork_path: l.artworkPath ?? null,
    })),
    p_meta: metaToRpc(meta),
  })
  if (error) throw new Error(error.message)

  // Best-effort order confirmation email (works once the function is deployed).
  // The function looks up recipient + content server-side from the order id.
  void sendOrderEmail(orderId as string)

  const order = await getOrder(orderId as string)
  if (!order) throw new Error('Bestellung nicht gefunden.')
  return order
}

/**
 * Portal mail events handled by the send-order-email Netlify function. The
 * function loads recipients and content server-side from the referenced row,
 * checks the caller may trigger the event, and sends each event at most once.
 *   created | shipped | cancelled | reclaimed | prices_confirmed → orderId
 *   quote_created                                                → quoteId
 *   inquiry_created                                              → inquiryId
 */
export type OrderMailEvent = 'created' | 'shipped' | 'cancelled' | 'reclaimed' | 'prices_confirmed' | 'tracking_updated'

export type PortalMail =
  | { event: OrderMailEvent; orderId: string }
  | { event: 'quote_created'; quoteId: string }
  | { event: 'inquiry_created'; inquiryId: string }

/** Best-effort portal mail via the Netlify function; never throws. */
export async function sendPortalMail(mail: PortalMail): Promise<void> {
  if (!supabase) return
  try {
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    if (!token) return
    await fetch('/api/send-order-email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(mail),
    })
  } catch {
    /* mail is best-effort */
  }
}

/** Best-effort order mail (confirmation / shipped / cancelled / reclaimed / tracking update). */
export function sendOrderEmail(
  orderId: string,
  event: OrderMailEvent = 'created',
): Promise<void> {
  return sendPortalMail({ event, orderId })
}

// --- Order actions: cancel (#15), reclaim (#15), approve/reject (#9) --------
function patchMockOrder(id: string, fn: (o: Order) => Order): Order {
  const orders = loadMockOrders()
  const idx = orders.findIndex((o) => o.id === id)
  if (idx < 0) throw new Error('Bestellung nicht gefunden.')
  const next = fn(orders[idx])
  orders[idx] = next
  saveMockOrders(orders)
  return next
}

export async function cancelOrder(id: string): Promise<Order> {
  if (USE_MOCK || !supabase) {
    await delay(300)
    const now = new Date().toISOString()
    return patchMockOrder(id, (o) => ({
      ...o,
      status: 'storniert',
      statusHistory: [...(o.statusHistory ?? []), { status: 'storniert', at: now, note: 'Vom Kunden storniert.' }],
    }))
  }
  // RPC checks ownership + status 'offen' and writes the audit entry; the
  // trg_order_status trigger records the status change in b2b_order_events.
  const { error } = await supabase.rpc('cancel_order', { p_order_id: id })
  if (error) throw new Error(error.message)
  void sendOrderEmail(id, 'cancelled')
  const order = await getOrder(id)
  if (!order) throw new Error('Bestellung nicht gefunden.')
  return order
}

export async function reclaimOrder(id: string, reason: string): Promise<Order> {
  if (USE_MOCK || !supabase) {
    await delay(300)
    return patchMockOrder(id, (o) => ({ ...o, reclamation: reason }))
  }
  const { error } = await supabase.rpc('reclaim_order', { p_order_id: id, p_reason: reason })
  if (error) throw new Error(error.message)
  void sendOrderEmail(id, 'reclaimed')
  const order = await getOrder(id)
  if (!order) throw new Error('Bestellung nicht gefunden.')
  return order
}

// ---------------------------------------------------------------------------
// Großanfrage (inquiry) — customer requests a quote.
// ---------------------------------------------------------------------------
export interface InquiryInput {
  productType: string
  quantity: number
  deadline?: string
  message?: string
  artworkFile?: File
}
const LS_INQUIRIES = 'ballina_mock_inquiries'

function loadMockInquiries(): Inquiry[] {
  try {
    const raw = localStorage.getItem(LS_INQUIRIES)
    if (raw) return JSON.parse(raw) as Inquiry[]
  } catch {
    /* ignore */
  }
  return []
}

/** Creates the inquiry and notifies the back office; returns the inquiry id. */
export async function createInquiry(input: InquiryInput): Promise<string> {
  // The id is generated here so the notification can reference the row.
  const id = crypto.randomUUID()
  if (USE_MOCK || !supabase) {
    await delay(400)
    const inquiry: Inquiry = {
      id,
      productType: input.productType,
      quantity: input.quantity,
      deadline: input.deadline,
      message: input.message,
      artworkName: input.artworkFile?.name,
      status: 'neu',
      createdAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem(LS_INQUIRIES, JSON.stringify([inquiry, ...loadMockInquiries()]))
    } catch {
      /* ignore */
    }
    return id
  }
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await currentProfile()
  if (!profile) throw new Error('Kein Firmenprofil gefunden.')
  const artworkPath = input.artworkFile ? await uploadArtwork(profile.companyId, input.artworkFile) : null
  const { error } = await supabase.from('b2b_inquiries').insert({
    id,
    company_id: profile.companyId,
    artwork_name: input.artworkFile?.name ?? null,
    artwork_path: artworkPath,
    contact_person: profile.name ?? null,
    email: user?.email ?? null,
    product_type: input.productType.trim(),
    quantity: input.quantity,
    deadline: input.deadline || null,
    message: input.message?.trim() || null,
    status: 'neu',
  })
  if (error) {
    console.error('[inquiry] insert failed:', error)
    throw new Error('Die Anfrage konnte nicht gesendet werden. Bitte erneut versuchen.')
  }
  void sendPortalMail({ event: 'inquiry_created', inquiryId: id })
  return id
}

/** The company's own inquiries, newest first (RLS: inq_own_read). */
export async function getInquiries(): Promise<Inquiry[]> {
  if (USE_MOCK || !supabase) {
    await delay()
    return loadMockInquiries()
  }
  const { data, error } = await supabase
    .from('b2b_inquiries')
    .select('id, product_type, quantity, deadline, message, artwork_name, artwork_path, status, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
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

// ---------------------------------------------------------------------------
// #4 Quotes (Angebote) — mock-persisted status, "accept" spawns a real order.
// ---------------------------------------------------------------------------
const LS_QUOTES = 'ballina_mock_quotes'

function loadMockQuotes(): Quote[] {
  try {
    const raw = localStorage.getItem(LS_QUOTES)
    if (raw) return JSON.parse(raw) as Quote[]
  } catch {
    /* ignore */
  }
  return [...MOCK_QUOTES]
}

function saveMockQuotes(quotes: Quote[]) {
  try {
    localStorage.setItem(LS_QUOTES, JSON.stringify(quotes))
  } catch {
    /* ignore */
  }
}

export async function getQuotes(): Promise<Quote[]> {
  if (USE_MOCK || !supabase) {
    await delay()
    return loadMockQuotes()
      .map((q) => (q.status === 'offen' && !isQuoteAcceptable(q) ? { ...q, status: 'abgelaufen' as QuoteStatus } : q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  // Flag overdue quotes as 'abgelaufen' before listing (idempotent, best-effort).
  await supabase.rpc('expire_quotes').then(
    () => undefined,
    () => undefined,
  )
  const { data, error } = await supabase
    .from('b2b_quotes')
    .select('*, b2b_quote_items(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapQuoteRow)
}

function quoteToLines(quote: Quote): CartLine[] {
  return quote.items.map(({ productId, productName, imageUrl, color, size, quantity, unitPrice }) => ({
    productId,
    productName,
    imageUrl,
    color,
    size,
    quantity,
    unitPrice,
  }))
}

/** Accept a quote → set it to "angenommen" and create the corresponding order. */
export async function acceptQuote(id: string, meta: OrderMeta = {}): Promise<Order> {
  if (USE_MOCK || !supabase) {
    await delay(400)
    const quotes = loadMockQuotes()
    const quote = quotes.find((q) => q.id === id)
    if (!quote) throw new Error('Angebot nicht gefunden.')
    if (!isQuoteAcceptable(quote)) throw new Error('Angebot ist nicht mehr gültig.')
    const ref = `Aus Angebot ${quote.quoteNumber} – ${quote.title}`
    const order = await createOrder(quoteToLines(quote), {
      ...meta,
      note: meta.note?.trim() ? `${ref}\n${meta.note.trim()}` : ref,
    })
    saveMockQuotes(
      quotes.map((q) => (q.id === id ? { ...q, status: 'angenommen' as QuoteStatus } : q)),
    )
    return order
  }
  // Atomic server-side RPC: checks ownership, status 'offen' and valid_until,
  // creates the order from the quote's own items/prices (+ PO, delivery
  // address, Wunschtermin) and marks the quote accepted in one transaction.
  const { data: orderId, error } = await supabase.rpc('accept_quote', { p_quote_id: id, p_meta: metaToRpc(meta) })
  if (error) throw new Error(error.message)
  void sendOrderEmail(orderId as string)
  const order = await getOrder(orderId as string)
  if (!order) throw new Error('Bestellung nicht gefunden.')
  return order
}

export async function declineQuote(id: string): Promise<void> {
  if (USE_MOCK || !supabase) {
    await delay()
    const quotes = loadMockQuotes()
    saveMockQuotes(
      quotes.map((q) => (q.id === id ? { ...q, status: 'abgelehnt' as QuoteStatus } : q)),
    )
    return
  }
  const { error } = await supabase.rpc('decline_quote', { p_quote_id: id })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// "Mein Konto" self-service (RPCs from 012; tenant columns stay guarded)
// ---------------------------------------------------------------------------
export async function updateMyProfile(name: string, phone: string): Promise<void> {
  if (USE_MOCK || !supabase) throw new Error('Im Demo-Modus nicht verfügbar.')
  const { error } = await supabase.rpc('update_my_profile', { p_name: name, p_phone: phone })
  if (error) throw new Error(error.message)
}

/** Default delivery address of the company; null resets it to the billing address. */
export async function updateMyDeliveryAddress(address: Address | null): Promise<void> {
  if (USE_MOCK || !supabase) throw new Error('Im Demo-Modus nicht verfügbar.')
  const { error } = await supabase.rpc('update_my_delivery_address', {
    p_address: address
      ? { line1: address.line1.trim(), zip: address.zip.trim(), city: address.city.trim(), country: address.country?.trim() || null }
      : null,
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Row mappers (snake_case DB → camelCase domain)
// ---------------------------------------------------------------------------
function mapOrderRow(r: any): Order {
  const events = (r.b2b_order_events ?? [])
    .map((e: any) => ({ status: e.status, at: e.at, note: e.note ?? undefined }))
    .sort((a: any, b: any) => a.at.localeCompare(b.at))
  return {
    id: r.id,
    orderNumber: r.order_number ?? r.id.slice(0, 8),
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
    poNumber: r.po_number ?? undefined,
    deliveryAddress: mapAddress(r.delivery_address),
    requestedDate: r.requested_date ?? undefined,
    statusHistory: events.length ? events : undefined,
    items: (r.b2b_order_items ?? []).map((it: any) => ({
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
    })),
  }
}

function mapAddress(a: any): Address | undefined {
  if (!a || typeof a !== 'object' || !a.line1) return undefined
  return {
    name: a.name ?? undefined,
    line1: a.line1,
    zip: a.zip ?? '',
    city: a.city ?? '',
    country: a.country ?? undefined,
  }
}

function mapQuoteRow(r: any): Quote {
  return {
    id: r.id,
    quoteNumber: r.quote_number,
    orderId: r.order_id ?? undefined,
    inquiryId: r.inquiry_id ?? undefined,
    withdrawnAt: r.withdrawn_at ?? undefined,
    title: r.title,
    createdAt: r.created_at,
    validUntil: r.valid_until,
    status: r.status,
    total: Number(r.total ?? 0),
    note: r.note ?? undefined,
    items: (r.b2b_quote_items ?? []).map((it: any) => ({
      id: it.id,
      productId: it.product_id,
      productName: it.product_name,
      imageUrl: it.image_url ?? '',
      color: it.color,
      size: it.size,
      quantity: it.quantity,
      unitPrice: Number(it.unit_price ?? 0),
    })),
  }
}

/** Current user's profile row (company_id, name) — used by the real-DB paths. */
async function currentProfile(): Promise<{ companyId: string; name?: string } | null> {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('b2b_profiles')
    .select('company_id, name')
    .eq('user_id', user.id)
    .maybeSingle()
  return data ? { companyId: data.company_id, name: data.name ?? undefined } : null
}
