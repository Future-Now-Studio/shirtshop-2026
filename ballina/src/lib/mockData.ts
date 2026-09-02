import type { Company, Order, Product, Quote } from './types'

// Realistic sample catalogue — Ballina textile range for a brewery customer.
// Images are royalty-free Unsplash apparel shots (swap for real WooCommerce media on go-live).
export const MOCK_COMPANY: Company = {
  id: 'c1',
  company: 'Brauhaus Lindental GmbH',
  contactPerson: 'Markus Lindenthal',
  email: 'einkauf@brauhaus-lindental.de',
  phone: '+49 351 2984710',
  customerNumber: 'B2B-10428',
  vatId: 'DE 812 345 678',
  billingAddress: {
    line1: 'Lindentalstraße 12',
    zip: '01277',
    city: 'Dresden',
    country: 'Deutschland',
  },
  deliveryAddress: {
    line1: 'Brauhaus Lindental – Lager, Zeithainer Str. 4',
    zip: '01279',
    city: 'Dresden',
    country: 'Deutschland',
  },
  paymentTerms: '14 Tage netto, auf Rechnung',
  discountPercent: 12, // #3 hinterlegte Firmenkondition
  annualBudget: 12000, // #10 Textilbudget pro Jahr
}

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    sku: 'PS-TS-CLASSIC',
    name: 'Classic T-Shirt',
    description: 'Schwerer 190 g/m² Baumwoll-Jersey, formstabil, ideal für Textildruck.',
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
    basePrice: 9.9,
    category: 'T-Shirts',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Schwarz', 'Weiß', 'Navy', 'Flaschengrün'],
    active: true,
  },
  {
    id: 'p2',
    sku: 'PS-POLO-PIQUE',
    name: 'Piqué Poloshirt',
    description: 'Klassisches Polo aus 220 g/m² Piqué mit Knopfleiste – gehobener Auftritt fürs Service-Team.',
    imageUrl: 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600&q=80',
    basePrice: 16.5,
    category: 'Polos',
    sizes: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
    colors: ['Schwarz', 'Weiß', 'Flaschengrün'],
    active: true,
  },
  {
    id: 'p3',
    sku: 'PS-HOOD-PREMIUM',
    name: 'Premium Hoodie',
    description: 'Kuscheliger 320 g/m² French-Terry-Hoodie mit Kängurutasche – der Bestseller im Winter.',
    imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80',
    basePrice: 29.9,
    category: 'Hoodies',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Schwarz', 'Anthrazit', 'Navy'],
    active: true,
  },
  {
    id: 'p4',
    sku: 'PS-CAP-6PANEL',
    name: '6-Panel Cap',
    description: 'Verstellbare Baumwoll-Cap mit Metallschnalle – perfekt für Logo-Stick.',
    imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&q=80',
    basePrice: 12.0,
    category: 'Caps',
    sizes: ['Einheitsgröße'],
    colors: ['Schwarz', 'Flaschengrün', 'Sand'],
    active: true,
  },
  {
    id: 'p5',
    sku: 'PS-APRON-BISTRO',
    name: 'Bistro-Schürze',
    description: 'Robuste Latzschürze, 240 g/m², mit Fronttasche – abwaschbar und langlebig.',
    imageUrl: 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&q=80',
    basePrice: 18.9,
    category: 'Schürzen',
    sizes: ['Einheitsgröße'],
    colors: ['Schwarz', 'Anthrazit'],
    active: true,
  },
  {
    id: 'p6',
    sku: 'PS-SOFTSHELL-PRO',
    name: 'Softshell-Jacke',
    description: 'Wind- und wasserabweisende 3-Lagen-Softshell mit Stehkragen – für Außendienst & Events.',
    imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80',
    basePrice: 44.9,
    category: 'Jacken',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Schwarz', 'Navy'],
    active: true,
  },
]

const p = (id: string) => MOCK_PRODUCTS.find((x) => x.id === id)!

export const MOCK_ORDERS: Order[] = [
  {
    id: 'o1',
    orderNumber: '2026-0342',
    status: 'abgeschlossen',
    createdAt: '2026-06-14T09:12:00Z',
    note: 'Logo weiß, Brust links + Rücken groß.',
    total: 1188.0,

    trackingCarrier: 'DHL',
    trackingNumber: '00340434290612345678',
    trackingUrl: 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=00340434290612345678',
    statusHistory: [
      { status: 'offen', at: '2026-06-14T09:12:00Z' },
      { status: 'in_bearbeitung', at: '2026-06-15T10:30:00Z', note: 'Druckdaten geprüft, Produktion gestartet.' },
      { status: 'versendet', at: '2026-06-19T16:05:00Z', note: 'DHL, 3 Paket(e).' },
      { status: 'abgeschlossen', at: '2026-06-21T11:20:00Z' },
    ],
    items: [
      { id: 'i1', productId: 'p1', productName: p('p1').name, imageUrl: p('p1').imageUrl, color: 'Flaschengrün', size: 'L', quantity: 60, unitPrice: 9.9 },
      { id: 'i2', productId: 'p1', productName: p('p1').name, imageUrl: p('p1').imageUrl, color: 'Flaschengrün', size: 'XL', quantity: 40, unitPrice: 9.9 },
      { id: 'i3', productId: 'p2', productName: p('p2').name, imageUrl: p('p2').imageUrl, color: 'Schwarz', size: 'L', quantity: 12, unitPrice: 16.5 },
    ],
  },
  {
    id: 'o2',
    orderNumber: '2026-0401',
    status: 'versendet',
    createdAt: '2026-07-28T14:03:00Z',
    note: 'Sommerfest-Ausstattung.',
    total: 705.6,

    trackingCarrier: 'DHL',
    trackingNumber: '00340434290698765432',
    trackingUrl: 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=00340434290698765432',
    statusHistory: [
      { status: 'offen', at: '2026-07-28T14:03:00Z' },
      { status: 'in_bearbeitung', at: '2026-07-29T09:15:00Z' },
      { status: 'versendet', at: '2026-08-01T15:40:00Z', note: 'DHL, 2 Paket(e).' },
    ],
    items: [
      { id: 'i4', productId: 'p4', productName: p('p4').name, imageUrl: p('p4').imageUrl, color: 'Flaschengrün', size: 'Einheitsgröße', quantity: 48, unitPrice: 12.0 },
      { id: 'i5', productId: 'p5', productName: p('p5').name, imageUrl: p('p5').imageUrl, color: 'Schwarz', size: 'Einheitsgröße', quantity: 7, unitPrice: 18.9 },
    ],
  },
  {
    id: 'o3',
    orderNumber: '2026-0455',
    status: 'in_bearbeitung',
    createdAt: '2026-08-19T08:40:00Z',
    note: 'Neue Mitarbeiter Herbst.',
    total: 897.0,

    statusHistory: [
      { status: 'offen', at: '2026-08-19T08:40:00Z' },
      { status: 'in_bearbeitung', at: '2026-08-20T11:00:00Z', note: 'In Produktion.' },
    ],
    items: [
      { id: 'i6', productId: 'p3', productName: p('p3').name, imageUrl: p('p3').imageUrl, color: 'Anthrazit', size: 'M', quantity: 15, unitPrice: 29.9 },
      { id: 'i7', productId: 'p3', productName: p('p3').name, imageUrl: p('p3').imageUrl, color: 'Anthrazit', size: 'L', quantity: 15, unitPrice: 29.9 },
    ],
  },
]

// #4 Angebote der Werkstatt auf Großanfragen — annehmen erzeugt eine Bestellung.
export const MOCK_QUOTES: Quote[] = [
  {
    id: 'q1',
    quoteNumber: 'AN-2026-0088',
    title: 'Winterjacken Außendienst 2026',
    createdAt: '2026-08-22T10:00:00Z',
    validUntil: '2026-09-30T23:59:00Z',
    status: 'offen',
    total: 2245.0,
    note: 'Preis inkl. Rückenstick Logo, gestaffelt ab 50 Stück.',
    items: [
      { id: 'qi1', productId: 'p6', productName: p('p6').name, imageUrl: p('p6').imageUrl, color: 'Schwarz', size: 'L', quantity: 30, unitPrice: 44.9 },
      { id: 'qi2', productId: 'p6', productName: p('p6').name, imageUrl: p('p6').imageUrl, color: 'Schwarz', size: 'XL', quantity: 20, unitPrice: 44.9 },
    ],
  },
]
