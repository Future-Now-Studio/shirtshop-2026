import type { Product } from './types'

// All catalogue calls go through the Vite dev proxy (/api/wc → WooCommerce),
// so credentials never reach the browser and there is no CORS issue.
const WC_BASE = '/api/wc'

interface WCImage {
  src: string
}
interface WCTerm {
  id: number
  name: string
  slug: string
}
interface WCAttribute {
  id: number
  name: string
  options: string[]
}
interface WCProduct {
  id: number
  name: string
  sku: string
  description: string
  short_description: string
  price: string
  regular_price: string
  status: string
  catalog_visibility: string
  images: WCImage[]
  categories: WCTerm[]
  attributes: WCAttribute[]
}

function stripHtml(html: string): string {
  const el = document.createElement('div')
  el.innerHTML = html
  return (el.textContent || '').replace(/\s+/g, ' ').trim()
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL']

function pickAttribute(attrs: WCAttribute[], keywords: string[]): string[] {
  const match = attrs.find((a) => keywords.some((k) => a.name.toLowerCase().includes(k)))
  return match?.options ?? []
}

function mapProduct(wc: WCProduct): Product {
  const sizes = pickAttribute(wc.attributes, ['größe', 'grosse', 'size']).sort(
    (a, b) => SIZE_ORDER.indexOf(a.toUpperCase()) - SIZE_ORDER.indexOf(b.toUpperCase()),
  )
  const colors = pickAttribute(wc.attributes, ['farbe', 'color', 'colour'])
  const price = parseFloat(wc.price || wc.regular_price || '0')
  const base = Number.isFinite(price) ? price : 0
  const round = (n: number) => Math.round(n * 100) / 100
  // B2B staffel prices (WooCommerce has no native tier field): derive sensible
  // volume breaks off the list price so the catalogue behaves like a B2B one.
  const priceTiers = base > 0
    ? [
        { minQty: 50, unitPrice: round(base * 0.95) },
        { minQty: 100, unitPrice: round(base * 0.9) },
        { minQty: 250, unitPrice: round(base * 0.85) },
      ]
    : undefined
  return {
    id: String(wc.id),
    sku: wc.sku || `WC-${wc.id}`,
    name: wc.name,
    description: stripHtml(wc.short_description || wc.description || ''),
    imageUrl: wc.images?.[0]?.src ?? '',
    basePrice: base,
    category: wc.categories?.[0]?.name ?? 'Sonstiges',
    sizes: sizes.length ? sizes : ['S', 'M', 'L', 'XL', 'XXL'],
    colors: colors.length ? colors : ['Schwarz', 'Weiß'],
    active: wc.status === 'publish',
    minOrderQty: 10,
    priceTiers,
  }
}

export async function fetchWooCommerceProducts(): Promise<Product[]> {
  const res = await fetch(`${WC_BASE}/products?per_page=50&status=publish&_fields=` +
    'id,name,sku,description,short_description,price,regular_price,status,catalog_visibility,images,categories,attributes')
  if (!res.ok) throw new Error(`WooCommerce ${res.status}`)
  const data = (await res.json()) as WCProduct[]
  return data.map(mapProduct).filter((p) => p.active)
}
