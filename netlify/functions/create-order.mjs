// Netlify Function V2 – creates a WooCommerce order after successful Stripe payment.

const WC_BASE = 'https://timob10.sg-host.com/wp-json/wc/v3';

const ALLOWED_ORIGINS = [
  'https://private-shirt.de',
  'https://www.private-shirt.de',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function wcAuthHeader() {
  const key = process.env.WC_CONSUMER_KEY;
  const secret = process.env.WC_CONSUMER_SECRET;
  if (!key || !secret) return null;
  return `Basic ${btoa(`${key}:${secret}`)}`;
}

function buildLineItem(item) {
  if (item.productId !== 999 && (!item.productId || item.productId <= 0)) {
    throw new Error(`Invalid product_id: ${item.productId} for item ${item.name}`);
  }

  const hasDesign = !!(item.customDesigns || item.customDesign);
  const designElementCount = item.designElementCount || 0;

  // Human-readable name: "B&C Inspire Hoodie – Schwarz / L (individuell gestaltet)"
  const variantSuffix = [item.color, item.size].filter(Boolean).join(' / ');
  const designSuffix = hasDesign ? ' (individuell gestaltet)' : '';
  const displayName = `${item.name}${variantSuffix ? ' – ' + variantSuffix : ''}${designSuffix}`;

  const itemMeta = [
    { key: 'Farbe', value: item.color || '–' },
    { key: 'Größe', value: item.size || '–' },
  ];

  if (hasDesign) {
    itemMeta.push({ key: 'Individuelles Design', value: 'Ja' });
  }
  if (designElementCount > 0) {
    itemMeta.push(
      { key: 'Design-Elemente', value: designElementCount.toString() },
      { key: 'Design-Aufpreis', value: `${(designElementCount * 10).toFixed(2)} €` },
    );
  }

  const pricePerUnit = item.price + designElementCount * 10;
  const subtotal = pricePerUnit * item.quantity;

  const lineItem = { quantity: item.quantity, name: displayName, meta_data: itemMeta };
  const isCustom = String(item.productId) === '999';

  if (isCustom) {
    lineItem.sku = `CUSTOM-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    lineItem.price = pricePerUnit.toString();
    lineItem.subtotal = subtotal.toString();
    lineItem.total = subtotal.toString();
  } else {
    lineItem.product_id = item.productId;
    if (designElementCount > 0 || pricePerUnit !== item.price) {
      lineItem.subtotal = subtotal.toString();
      lineItem.total = subtotal.toString();
    }
  }

  return lineItem;
}

function buildOrderNote(items) {
  const lines = ['=== BESTELLDETAILS ==='];
  items.forEach((item, i) => {
    const hasDesign = !!(item.customDesigns || item.customDesign);
    lines.push(`\nPosition ${i + 1}: ${item.name}`);
    lines.push(`  Farbe: ${item.color || '–'} | Größe: ${item.size || '–'} | Menge: ${item.quantity}`);
    if (hasDesign) {
      const views = item.customDesigns ? Object.keys(item.customDesigns).join(', ') : 'Standard';
      lines.push(`  Individuelles Design: Ja (Ansichten: ${views})`);
    }
    if (item.designElementCount > 0) {
      lines.push(`  Design-Elemente: ${item.designElementCount} (+${(item.designElementCount * 10).toFixed(2)} €)`);
    }
  });
  return lines.join('\n');
}

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const auth = wcAuthHeader();
  if (!auth) {
    return new Response(JSON.stringify({ error: 'WooCommerce not configured' }), { status: 500, headers });
  }

  try {
    const { items, shipping, billing, paymentIntentId, transactionId, total } = await req.json();

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: 'No items provided' }), { status: 400, headers });
    }

    const lineItems = items.map(buildLineItem);

    const orderData = {
      status: 'processing',
      currency: 'EUR',
      customer_id: 0,
      set_paid: true,
      billing: {
        first_name: billing.firstName || '',
        last_name: billing.lastName || '',
        company: '',
        address_1: billing.address || '',
        address_2: '',
        city: billing.city || '',
        state: '',
        postcode: billing.postalCode || '',
        country: billing.country || 'DE',
        email: billing.email || '',
        phone: billing.phone || '',
      },
      shipping: {
        first_name: billing.firstName || '',
        last_name: billing.lastName || '',
        company: '',
        address_1: billing.address || '',
        address_2: '',
        city: billing.city || '',
        state: '',
        postcode: billing.postalCode || '',
        country: billing.country || 'DE',
      },
      payment_method: 'stripe',
      payment_method_title: 'Stripe',
      transaction_id: transactionId || paymentIntentId || '',
      line_items: lineItems,
      shipping_total:
        typeof shipping === 'object' && shipping !== null
          ? (shipping.total?.toString() || '0')
          : (typeof shipping === 'number' ? shipping.toString() : '0'),
      total: total?.toString() || '0',
      total_tax: '0',
      cart_tax: '0',
      customer_note: buildOrderNote(items),
      meta_data: [
        { key: '_stripe_payment_intent_id', value: paymentIntentId || '' },
        { key: '_stripe_transaction_id', value: transactionId || '' },
        // Store design images per item as separate meta entries (readable in WC admin)
        ...items.flatMap((item, i) => {
          const entries = [];
          if (item.customDesigns && Object.keys(item.customDesigns).length > 0) {
            for (const [view, img] of Object.entries(item.customDesigns)) {
              if (img && img.length < 500_000) {
                entries.push({ key: `_design_item_${i + 1}_${view}`, value: img });
              }
            }
          } else if (item.customDesign && item.customDesign.length < 500_000) {
            entries.push({ key: `_design_item_${i + 1}_front`, value: item.customDesign });
          }
          if (item.customDesignRaw && item.customDesignRaw.length < 200_000) {
            entries.push({ key: `_design_raw_item_${i + 1}`, value: item.customDesignRaw });
          }
          return entries;
        }),
      ],
    };

    const response = await fetch(`${WC_BASE}/orders`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WC order create failed:', response.status, errorText.substring(0, 500));
      return new Response(
        JSON.stringify({ error: `WooCommerce order creation failed: ${response.status}` }),
        { status: 502, headers },
      );
    }

    const order = await response.json();
    return new Response(
      JSON.stringify({ success: true, orderId: order.id, orderNumber: order.number }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error('create-order error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create order', success: false }),
      { status: 500, headers },
    );
  }
};

export const config = { path: '/api/create-order' };
