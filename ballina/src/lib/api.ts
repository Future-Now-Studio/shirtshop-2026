import { supabase, USE_MOCK } from './supabase'
import { MOCK_COMPANY, MOCK_ORDERS, MOCK_PRODUCTS, MOCK_QUOTES } from './mockData'
import { fetchWooCommerceProducts } from './woocommerce'
import type {
  CartLine,
  Company,
  Order,
  OrderStatus,
  Product,
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
  const year = 2026
  const maxSeq = orders
    .map((o) => parseInt(o.orderNumber.split('-')[1] ?? '0', 10))
    .reduce((a, b) => Math.max(a, b), 500)
  return `${year}-${String(maxSeq + 1).padStart(4, '0')}`
}

// ---------------------------------------------------------------------------
// Public API — pages/hooks call these regardless of backend.
// ---------------------------------------------------------------------------
export async function getProducts(): Promise<Product[]> {
  // The catalogue always reflects the live main store (WooCommerce),
  // independent of the mock/Supabase flag used for auth + orders.
  try {
    const products = await fetchWooCommerceProducts()
    if (products.length) return products
  } catch (err) {
    console.warn('[catalogue] WooCommerce fetch failed, falling back to samples:', err)
  }
  return MOCK_PRODUCTS.filter((p) => p.active)
}

export async function getCompany(): Promise<Company> {
  if (USE_MOCK || !supabase) {
    await delay()
    return MOCK_COMPANY
  }
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('b2b_profiles')
    .select('name, email')
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
    customerNumber: comp.customer_number ?? undefined,
    vatId: comp.vat_id ?? undefined,
    billingAddress: billing,
    deliveryAddress: delivery,
    paymentTerms: comp.payment_terms ?? undefined,
    discountPercent: comp.discount_percent != null ? Number(comp.discount_percent) : undefined,
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
  const { data, error } = await supabase
    .from('b2b_orders')
    .select('*, b2b_order_items(*), b2b_order_events(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data ? mapOrderRow(data) : null
}

export async function createOrder(lines: CartLine[], note?: string): Promise<Order> {
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
      note,
      createdAt: now,
      statusHistory: [{ status: 'offen', at: now, note: 'Bestellung eingegangen.' }],
      items: lines.map((l, idx) => ({ id: `i_${Date.now()}_${idx}`, ...l })),
    }
    saveMockOrders([order, ...orders])
    return order
  }

  const { data: { user } } = await supabase.auth.getUser()
  const profile = await currentProfile()
  if (!profile) throw new Error('Kein Firmenprofil gefunden.')
  const { data: orderRow, error } = await supabase
    .from('b2b_orders')
    .insert({
      company_id: profile.companyId,
      created_by: user?.id,
      status: 'offen' as OrderStatus,
      total,
      note,
    })
    .select()
    .single()
  if (error) throw error
  const itemRows = lines.map((l) => ({
    order_id: orderRow.id,
    product_id: l.productId,
    product_name: l.productName,
    image_url: l.imageUrl,
    color: l.color,
    size: l.size,
    quantity: l.quantity,
    unit_price: l.unitPrice,
    print_position: l.printPosition ?? null,
    artwork_name: l.artworkName ?? null,
  }))
  const { error: itemsErr } = await supabase.from('b2b_order_items').insert(itemRows)
  if (itemsErr) throw itemsErr

  // Best-effort order confirmation email (works once the function is deployed).
  if (user?.email) {
    fetch('/api/send-order-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: user.email,
        orderNumber: orderRow.order_number,
        total,
        items: lines.map((l) => ({ productName: l.productName, color: l.color, size: l.size, quantity: l.quantity })),
      }),
    }).catch(() => {})
  }

  return (await getOrder(orderRow.id))!
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
  await delay(300)
  const now = new Date().toISOString()
  return patchMockOrder(id, (o) => ({
    ...o,
    status: 'storniert',
    statusHistory: [...(o.statusHistory ?? []), { status: 'storniert', at: now, note: 'Vom Kunden storniert.' }],
  }))
}

export async function reclaimOrder(id: string, reason: string): Promise<Order> {
  await delay(300)
  return patchMockOrder(id, (o) => ({ ...o, reclamation: reason }))
}

// ---------------------------------------------------------------------------
// Großanfrage (inquiry) — customer requests a quote.
// ---------------------------------------------------------------------------
export interface InquiryInput {
  productType: string
  quantity: number
  deadline?: string
  message?: string
}
export async function createInquiry(input: InquiryInput): Promise<void> {
  if (USE_MOCK || !supabase) {
    await delay(400)
    return
  }
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await currentProfile()
  if (!profile) throw new Error('Kein Firmenprofil gefunden.')
  const { error } = await supabase.from('b2b_inquiries').insert({
    company_id: profile.companyId,
    email: user?.email ?? null,
    product_type: input.productType,
    quantity: input.quantity,
    deadline: input.deadline || null,
    message: input.message || null,
    status: 'neu',
  })
  if (error) throw error
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
    return loadMockQuotes().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
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
export async function acceptQuote(id: string): Promise<Order> {
  if (USE_MOCK || !supabase) {
    await delay(400)
    const quotes = loadMockQuotes()
    const quote = quotes.find((q) => q.id === id)
    if (!quote) throw new Error('Angebot nicht gefunden.')
    const order = await createOrder(quoteToLines(quote), `Aus Angebot ${quote.quoteNumber} – ${quote.title}`)
    saveMockQuotes(
      quotes.map((q) => (q.id === id ? { ...q, status: 'angenommen' as QuoteStatus } : q)),
    )
    return order
  }
  const { data: quoteRow, error } = await supabase
    .from('b2b_quotes')
    .select('*, b2b_quote_items(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  const quote = mapQuoteRow(quoteRow)
  const order = await createOrder(quoteToLines(quote), `Aus Angebot ${quote.quoteNumber} – ${quote.title}`)
  const { error: updErr } = await supabase
    .from('b2b_quotes')
    .update({ status: 'angenommen' as QuoteStatus, order_id: order.id })
    .eq('id', id)
  if (updErr) throw updErr
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
  const { error } = await supabase
    .from('b2b_quotes')
    .update({ status: 'abgelehnt' as QuoteStatus })
    .eq('id', id)
  if (error) throw error
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
    note: r.note ?? undefined,
    createdAt: r.created_at,
    trackingCarrier: r.tracking_carrier ?? undefined,
    trackingNumber: r.tracking_number ?? undefined,
    trackingUrl: r.tracking_url ?? undefined,
    reclamation: r.reclamation ?? undefined,
    invoiceName: r.invoice_name ?? undefined,
    invoiceDataUrl: r.invoice_url ?? undefined,
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
    })),
  }
}

function mapQuoteRow(r: any): Quote {
  return {
    id: r.id,
    quoteNumber: r.quote_number,
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

/** Current user's profile row (company_id) — used by the real-DB paths. */
async function currentProfile(): Promise<{ companyId: string } | null> {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('b2b_profiles')
    .select('company_id')
    .eq('user_id', user.id)
    .single()
  return data ? { companyId: data.company_id } : null
}
