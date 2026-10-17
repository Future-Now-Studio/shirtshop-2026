// Shared checkout flows (PaymentIntent creation + verified WooCommerce order creation).
// Framework-agnostic: each function returns { status, body } so both the Netlify
// functions and the Express dev server (server.js) can use them.

import {
  CURRENCY,
  HttpError,
  formatCents,
  quoteCart,
  wcRequest,
} from './pricing.mjs';

const AMOUNT_TOLERANCE_CENTS = 1;
const ORDER_LOCK_TTL_MS = 2 * 60 * 1000;

// Per-instance guard against concurrent duplicate requests for the same PaymentIntent.
const inFlight = new Map();

function errorResult(error, fallback) {
  if (error instanceof HttpError) return { status: error.status, body: { success: false, error: error.message } };
  console.error(fallback, error);
  return { status: 500, body: { success: false, error: fallback } };
}

function truncate(s, max) {
  return s.length <= max ? s : `${s.substring(0, max - 3)}...`;
}

// ---------------------------------------------------------------------------
// PaymentIntent
// ---------------------------------------------------------------------------

/**
 * Creates a PaymentIntent for the cart. Any client-supplied amount/currency is ignored.
 */
export async function createPaymentIntentForCart({ stripe, wc, items }) {
  try {
    const quote = await quoteCart(wc, items);

    const metadata = {
      cart_hash: quote.hash,
      item_count: String(quote.lines.length),
      total_items: String(quote.lines.reduce((s, l) => s + l.quantity, 0)),
      product_ids: truncate(quote.lines.map((l) => l.productId).join(','), 500),
      items: truncate(quote.lines.map((l) => `${l.productName} (${l.quantity}x)`).join(', '), 500),
      subtotal_cents: String(quote.subtotalCents),
      shipping_cents: String(quote.shippingCents),
    };

    const paymentIntent = await stripe.paymentIntents.create({
      amount: quote.totalCents,
      currency: CURRENCY,
      automatic_payment_methods: { enabled: true, allow_redirects: 'always' },
      metadata,
    });

    return {
      status: 200,
      body: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: quote.totalCents / 100,
        subtotal: quote.subtotalCents / 100,
        shipping: quote.shippingCents / 100,
        currency: CURRENCY,
      },
    };
  } catch (error) {
    return errorResult(error, 'Failed to create payment intent');
  }
}

// ---------------------------------------------------------------------------
// Order creation
// ---------------------------------------------------------------------------

function cleanField(value, max = 200) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().substring(0, max);
}

function normalizeCountry(value) {
  const v = cleanField(value, 60);
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  const map = { deutschland: 'DE', germany: 'DE', österreich: 'AT', oesterreich: 'AT', austria: 'AT', schweiz: 'CH', switzerland: 'CH' };
  return map[v.toLowerCase()] || (v ? v : 'DE');
}

function buildAddress(billing) {
  const b = billing && typeof billing === 'object' ? billing : {};
  const email = cleanField(b.email, 254);
  return {
    first_name: cleanField(b.firstName, 100),
    last_name: cleanField(b.lastName, 100),
    company: '',
    address_1: cleanField(b.address, 200),
    address_2: '',
    city: cleanField(b.city, 100),
    state: '',
    postcode: cleanField(b.postalCode, 20),
    country: normalizeCountry(b.country),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    phone: cleanField(b.phone, 50),
  };
}

function buildLineItems(quote, rawItems) {
  return quote.lines.map((line, i) => {
    const raw = rawItems[i] || {};
    const hasDesign = !!(raw.customDesigns || raw.customDesign);
    const variantSuffix = [line.color, line.size].filter(Boolean).join(' / ');
    const name = `${line.productName}${variantSuffix ? ' – ' + variantSuffix : ''}${hasDesign ? ' (individuell gestaltet)' : ''}`;

    const meta = [
      { key: 'Farbe', value: line.color || '–' },
      { key: 'Größe', value: line.size || '–' },
    ];
    if (hasDesign) meta.push({ key: 'Individuelles Design', value: 'Ja' });
    if (line.designElementCount > 0) {
      meta.push(
        { key: 'Design-Elemente', value: String(line.designElementCount) },
        { key: 'Design-Aufpreis', value: `${formatCents(line.designElementCount * 1000)} €` },
      );
    }

    // Server-computed prices only (client `price` is ignored).
    const lineItem = {
      quantity: line.quantity,
      name,
      meta_data: meta,
      subtotal: formatCents(line.lineCents),
      total: formatCents(line.lineCents),
    };
    if (line.isCustom) {
      lineItem.sku = `CUSTOM-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      lineItem.price = formatCents(line.unitCents);
    } else {
      lineItem.product_id = line.productId;
    }
    return lineItem;
  });
}

function buildDesignMeta(rawItems) {
  return rawItems.flatMap((item, i) => {
    const entries = [];
    if (!item || typeof item !== 'object') return entries;
    if (item.customDesigns && typeof item.customDesigns === 'object') {
      for (const [view, img] of Object.entries(item.customDesigns)) {
        if (/^[a-z]{1,10}$/.test(view) && typeof img === 'string' && img.startsWith('data:image/') && img.length < 500_000) {
          entries.push({ key: `_design_item_${i + 1}_${view}`, value: img });
        }
      }
    } else if (typeof item.customDesign === 'string' && item.customDesign.startsWith('data:image/') && item.customDesign.length < 500_000) {
      entries.push({ key: `_design_item_${i + 1}_front`, value: item.customDesign });
    }
    if (typeof item.customDesignRaw === 'string' && item.customDesignRaw.length < 200_000) {
      entries.push({ key: `_design_raw_item_${i + 1}`, value: item.customDesignRaw });
    }
    return entries;
  });
}

function buildOrderNote(quote, rawItems) {
  const lines = ['=== BESTELLDETAILS ==='];
  quote.lines.forEach((line, i) => {
    const raw = rawItems[i] || {};
    lines.push(`\nPosition ${i + 1}: ${line.productName}`);
    lines.push(`  Farbe: ${line.color || '–'} | Größe: ${line.size || '–'} | Menge: ${line.quantity}`);
    if (raw.customDesigns || raw.customDesign) {
      const views = raw.customDesigns && typeof raw.customDesigns === 'object'
        ? Object.keys(raw.customDesigns).filter((v) => /^[a-z]{1,10}$/.test(v)).join(', ')
        : 'Standard';
      lines.push(`  Individuelles Design: Ja (Ansichten: ${views})`);
    }
    if (line.designElementCount > 0) {
      lines.push(`  Design-Elemente: ${line.designElementCount} (+${formatCents(line.designElementCount * 1000)} €)`);
    }
  });
  return lines.join('\n');
}

/**
 * Verifies the Stripe payment and creates the WooCommerce order exactly once.
 * Request body: { items, billing, paymentIntentId }. Client totals/prices are ignored.
 */
export async function createOrderFromPayment({ stripe, wc, body }) {
  const paymentIntentId = body && typeof body.paymentIntentId === 'string' ? body.paymentIntentId : '';
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
    return { status: 400, body: { success: false, error: 'paymentIntentId required' } };
  }

  if (inFlight.has(paymentIntentId)) return inFlight.get(paymentIntentId);
  const promise = createOrderInner({ stripe, wc, body, paymentIntentId }).finally(() => {
    inFlight.delete(paymentIntentId);
  });
  inFlight.set(paymentIntentId, promise);
  return promise;
}

async function createOrderInner({ stripe, wc, body, paymentIntentId }) {
  let lockSet = false;
  try {
    const items = body.items;
    const quote = await quoteCart(wc, items);

    let intent;
    try {
      intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (err) {
      console.error('PaymentIntent retrieve failed:', err?.message);
      throw new HttpError(400, 'Unknown payment');
    }

    if (intent.status !== 'succeeded') throw new HttpError(402, 'Payment not completed');
    if (intent.currency !== CURRENCY) throw new HttpError(400, 'Invalid payment currency');
    if (intent.metadata?.cart_hash !== quote.hash) throw new HttpError(400, 'Cart does not match payment');
    const received = typeof intent.amount_received === 'number' && intent.amount_received > 0
      ? intent.amount_received
      : intent.amount;
    if (Math.abs(intent.amount - quote.totalCents) > AMOUNT_TOLERANCE_CENTS
        || Math.abs(received - quote.totalCents) > AMOUNT_TOLERANCE_CENTS) {
      console.error('Amount mismatch for', paymentIntentId, { intent: intent.amount, received, expected: quote.totalCents });
      throw new HttpError(400, 'Payment amount does not match order total');
    }

    // Idempotency: order already created for this payment?
    if (intent.metadata?.wc_order_id) {
      return {
        status: 200,
        body: {
          success: true,
          orderId: Number(intent.metadata.wc_order_id),
          orderNumber: intent.metadata.wc_order_number || intent.metadata.wc_order_id,
          duplicate: true,
        },
      };
    }
    const lockedAt = Number(intent.metadata?.wc_order_lock || 0);
    if (lockedAt && Date.now() - lockedAt < ORDER_LOCK_TTL_MS) {
      throw new HttpError(409, 'Order is already being created for this payment');
    }
    await stripe.paymentIntents.update(paymentIntentId, { metadata: { wc_order_lock: String(Date.now()) } });
    lockSet = true;

    const items_ = Array.isArray(items) ? items : [];
    const address = buildAddress(body.billing);
    if (!address.email && typeof intent.receipt_email === 'string') address.email = intent.receipt_email;
    const { email: _email, phone: _phone, ...shippingAddress } = address;

    const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;

    const orderData = {
      status: 'processing',
      currency: 'EUR',
      customer_id: 0,
      set_paid: true, // verified above: PaymentIntent succeeded with the server-computed amount
      billing: address,
      shipping: shippingAddress,
      payment_method: 'stripe',
      payment_method_title: 'Stripe',
      transaction_id: chargeId || paymentIntentId,
      line_items: buildLineItems(quote, items_),
      shipping_lines: quote.shippingCents > 0
        ? [{ method_id: 'flat_rate', method_title: 'Versand', total: formatCents(quote.shippingCents) }]
        : [{ method_id: 'free_shipping', method_title: 'Kostenloser Versand', total: '0.00' }],
      customer_note: buildOrderNote(quote, items_),
      meta_data: [
        { key: '_stripe_payment_intent', value: paymentIntentId },
        { key: '_stripe_payment_intent_id', value: paymentIntentId },
        { key: '_stripe_charge_id', value: chargeId || '' },
        { key: '_stripe_amount_cents', value: String(intent.amount) },
        ...buildDesignMeta(items_),
      ],
    };

    const order = await wcRequest(wc, 'orders', { method: 'POST', body: orderData });

    try {
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: { wc_order_id: String(order.id), wc_order_number: String(order.number ?? order.id), wc_order_lock: '' },
      });
    } catch (err) {
      // Order exists; the lock still prevents immediate duplicates. Log for reconciliation.
      console.error('Could not store WC order id on PaymentIntent', paymentIntentId, err?.message);
    }
    lockSet = false;

    return { status: 200, body: { success: true, orderId: order.id, orderNumber: order.number } };
  } catch (error) {
    if (lockSet) {
      await stripe.paymentIntents
        .update(paymentIntentId, { metadata: { wc_order_lock: '' } })
        .catch((err) => console.error('Could not release order lock', paymentIntentId, err?.message));
    }
    return errorResult(error, 'Failed to create order');
  }
}
