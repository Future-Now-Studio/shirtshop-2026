import type { AdminInquiry, AdminOrder, AdminQuote, Company } from './types'

// Several B2B customers for the back-office (the customer-facing app only ever
// sees its own company; the admin sees them all).
export const ADMIN_CUSTOMERS: Company[] = [
  {
    id: 'c1',
    company: 'Brauhaus Lindental GmbH',
    contactPerson: 'Markus Lindenthal',
    email: 'einkauf@brauhaus-lindental.de',
    phone: '+49 351 2984710',
    customerNumber: 'B2B-10428',
    vatId: 'DE 812 345 678',
    billingAddress: { line1: 'Lindentalstraße 12', zip: '01277', city: 'Dresden', country: 'Deutschland' },
    discountPercent: 12,
    annualBudget: 12000,
    paymentTerms: '14 Tage netto',
  },
  {
    id: 'c2',
    company: 'Alpenblick Hotel & Resort',
    contactPerson: 'Carla Brenner',
    email: 'einkauf@alpenblick-resort.de',
    phone: '+49 8821 44120',
    customerNumber: 'B2B-10517',
    vatId: 'DE 245 998 110',
    billingAddress: { line1: 'Zugspitzstraße 8', zip: '82467', city: 'Garmisch', country: 'Deutschland' },
    discountPercent: 8,
    annualBudget: 9000,
    paymentTerms: '30 Tage netto',
  },
  {
    id: 'c3',
    company: 'Stadtwerke Mühlheim',
    contactPerson: 'Jens Adler',
    email: 'beschaffung@sw-muehlheim.de',
    phone: '+49 208 99010',
    customerNumber: 'B2B-10604',
    vatId: 'DE 118 220 447',
    billingAddress: { line1: 'Ruhrstraße 40', zip: '45468', city: 'Mühlheim', country: 'Deutschland' },
    discountPercent: 15,
    annualBudget: 24000,
    paymentTerms: '30 Tage netto',
  },
  {
    id: 'c4',
    company: 'GreenFork Catering',
    contactPerson: 'Nina Roth',
    email: 'office@greenfork.de',
    phone: '+49 30 552210',
    customerNumber: 'B2B-10688',
    billingAddress: { line1: 'Boxhagener Str. 5', zip: '10245', city: 'Berlin', country: 'Deutschland' },
    discountPercent: 5,
    annualBudget: 4000,
    paymentTerms: '14 Tage netto',
  },
]

const img = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200&q=80'

export const ADMIN_ORDERS: AdminOrder[] = [
  {
    id: 'ao1', companyId: 'c1', companyName: 'Brauhaus Lindental GmbH',
    orderNumber: '2026-0455', status: 'in_bearbeitung', total: 897.0,
    createdAt: '2026-08-19T08:40:00Z',
    statusHistory: [
      { status: 'offen', at: '2026-08-19T08:40:00Z' },
      { status: 'in_bearbeitung', at: '2026-08-20T11:00:00Z', note: 'In Produktion.' },
    ],
    items: [
      { id: 'i6', productId: 'p3', productName: 'Premium Hoodie', imageUrl: img, color: 'Anthrazit', size: 'M', quantity: 15, unitPrice: 29.9 },
      { id: 'i7', productId: 'p3', productName: 'Premium Hoodie', imageUrl: img, color: 'Anthrazit', size: 'L', quantity: 15, unitPrice: 29.9 },
    ],
  },
  {
    id: 'ao2', companyId: 'c2', companyName: 'Alpenblick Hotel & Resort',
    orderNumber: '2026-0462', status: 'offen', total: 1240.0,
    createdAt: '2026-08-27T09:10:00Z',
    statusHistory: [{ status: 'offen', at: '2026-08-27T09:10:00Z' }],
    items: [
      { id: 'i8', productId: 'p2', productName: 'Piqué Poloshirt', imageUrl: img, color: 'Weiß', size: 'L', quantity: 40, unitPrice: 15.18 },
      { id: 'i9', productId: 'p5', productName: 'Bistro-Schürze', imageUrl: img, color: 'Schwarz', size: 'Einheitsgröße', quantity: 35, unitPrice: 17.39 },
    ],
  },
  {
    id: 'ao3', companyId: 'c3', companyName: 'Stadtwerke Mühlheim',
    orderNumber: '2026-0470', status: 'versendet', total: 3820.0,
    createdAt: '2026-08-12T13:25:00Z',
    trackingCarrier: 'DHL', trackingNumber: '00340434290611223344',
    trackingUrl: 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=00340434290611223344',
    statusHistory: [
      { status: 'offen', at: '2026-08-12T13:25:00Z' },
      { status: 'in_bearbeitung', at: '2026-08-13T08:00:00Z' },
      { status: 'versendet', at: '2026-08-18T15:00:00Z', note: 'DHL, 6 Paket(e).' },
    ],
    items: [
      { id: 'i10', productId: 'p6', productName: 'Softshell-Jacke', imageUrl: img, color: 'Navy', size: 'L', quantity: 50, unitPrice: 38.17 },
      { id: 'i11', productId: 'p6', productName: 'Softshell-Jacke', imageUrl: img, color: 'Navy', size: 'XL', quantity: 50, unitPrice: 38.17 },
    ],
  },
  {
    id: 'ao4', companyId: 'c4', companyName: 'GreenFork Catering',
    orderNumber: '2026-0474', status: 'offen', total: 560.0,
    createdAt: '2026-08-29T16:40:00Z',
    statusHistory: [{ status: 'offen', at: '2026-08-29T16:40:00Z' }],
    items: [
      { id: 'i12', productId: 'p1', productName: 'Classic T-Shirt', imageUrl: img, color: 'Schwarz', size: 'M', quantity: 60, unitPrice: 9.4 },
    ],
  },
]

export const ADMIN_QUOTES: AdminQuote[] = [
  {
    id: 'aq1', companyId: 'c1', companyName: 'Brauhaus Lindental GmbH',
    quoteNumber: 'AN-2026-0088', title: 'Winterjacken Außendienst 2026',
    createdAt: '2026-08-22T10:00:00Z', validUntil: '2026-09-30T23:59:00Z',
    status: 'offen', total: 2245.0, note: 'Preis inkl. Rückenstick Logo, gestaffelt ab 50 Stück.',
    items: [
      { id: 'aqi1', productId: 'p6', productName: 'Softshell-Jacke', imageUrl: img, color: 'Schwarz', size: 'L', quantity: 30, unitPrice: 44.9 },
      { id: 'aqi2', productId: 'p6', productName: 'Softshell-Jacke', imageUrl: img, color: 'Schwarz', size: 'XL', quantity: 20, unitPrice: 44.9 },
    ],
  },
]

export const ADMIN_INQUIRIES: AdminInquiry[] = [
  {
    id: 'ai1', companyId: 'c2', companyName: 'Alpenblick Hotel & Resort',
    contactPerson: 'Carla Brenner', email: 'einkauf@alpenblick-resort.de',
    productType: 'Bademäntel mit Stick', quantity: 120, deadline: '2026-10-15',
    message: 'Frottee, weiß, Logo auf Brust. Bitte Angebot mit Staffelpreisen.',
    status: 'neu', createdAt: '2026-08-28T11:20:00Z',
  },
  {
    id: 'ai2', companyId: 'c3', companyName: 'Stadtwerke Mühlheim',
    contactPerson: 'Jens Adler', email: 'beschaffung@sw-muehlheim.de',
    productType: 'Warnschutz-Poloshirts EN ISO 20471', quantity: 200, deadline: '2026-11-01',
    message: 'Gelb/orange, mit Reflexstreifen und Aufdruck Stadtwerke.',
    status: 'neu', createdAt: '2026-08-30T09:05:00Z',
  },
]
