// Shared, server-side cart validation + pricing for the legacy WooCommerce shop.
// Used by netlify/functions/create-payment-intent.mjs, netlify/functions/create-order.mjs
// and the local Express dev server (server.js).
//
// NEVER trust prices or totals sent by the browser. Everything that influences the
// amount charged is recomputed here from WooCommerce product data and the fixed
// pricing rules that the frontend (src/stores/cartStore.ts, src/pages/Checkout.tsx,
// src/pages/TShirtDesigner.tsx) displays:
//
//   unit price  = WooCommerce product `price` (fallback `regular_price`)
//                 or 24.95 € for the designer's custom shirt (productId 999)
//               + 10 € per design element
//   line total  = unit price * quantity
//   shipping    = 4.95 €, free from a 50 € subtotal
//   total       = subtotal + shipping           (EUR, no volume discounts)
//
// All money is handled in integer cents.

import { createHash } from 'node:crypto';

export const CURRENCY = 'eur';
export const CUSTOM_PRODUCT_ID = 999;
export const CUSTOM_PRODUCT_NAME = 'Custom T-Shirt';
export const CUSTOM_PRODUCT_PRICE_CENTS = 2495; // TShirtDesigner.tsx: price: 24.95
export const DESIGN_ELEMENT_CENTS = 1000; // cartStore.ts: each design element adds 10 €
export const SHIPPING_CENTS = 495; // Checkout.tsx: SHIPPING_COST = 4.95
export const FREE_SHIPPING_THRESHOLD_CENTS = 5000; // Checkout.tsx: FREE_SHIPPING_THRESHOLD = 50

const MAX_LINES = 100;
const MAX_QUANTITY = 10000;
const MAX_DESIGN_ELEMENTS = 500;

const DEFAULT_WC_BASE_URL = 'https://timob10.sg-host.com/wp-json/wc/v3';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// WooCommerce access (server keys only)
// ---------------------------------------------------------------------------

/**
 * Reads the WooCommerce REST config from env. Returns null when the keys are missing.
 * WC_BASE_URL must point at the REST root, e.g. https://example.com/wp-json/wc/v3
 */
export function getWcConfig(env = process.env) {
  const key = env.WC_CONSUMER_KEY;
  const secret = env.WC_CONSUMER_SECRET;
  if (!key || !secret) return null;
  const baseUrl = (env.WC_BASE_URL || DEFAULT_WC_BASE_URL).replace(/\/+$/, '');
  return {
    baseUrl,
    authHeader: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
  };
}

export async function wcRequest(wc, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${wc.baseUrl}/${path.replace(/^\/+/, '')}`, {
    method,
    headers: {
      Authorization: wc.authHeader,
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`WooCommerce ${method} ${path.split('?')[0]} failed:`, res.status, text.substring(0, 300));
    throw new HttpError(502, `WooCommerce request failed (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Cart validation
// ---------------------------------------------------------------------------

function cleanString(value, max = 200) {
  if (typeof value !== 'string') return '';
  // strip control characters (incl. CR/LF) and trim
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().substring(0, max);
}

/**
 * Counts design elements the same way TShirtDesigner.tsx does: the sum of
 * `objects.length` over every view's Fabric.js JSON in customDesignRaw.
 */
export function countDesignElementsFromRaw(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return 0;
  try {
    const parsed = JSON.parse(raw);
    const views = parsed && typeof parsed === 'object' && parsed.views && typeof parsed.views === 'object'
      ? Object.values(parsed.views)
      : [];
    let count = 0;
    for (const view of views) {
      if (!view) continue;
      const data = typeof view === 'string' ? JSON.parse(view) : view;
      if (data && Array.isArray(data.objects)) count += data.objects.length;
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Validates the browser cart and returns a normalized list with only the fields that
 * matter for pricing. Throws HttpError(400) on invalid input.
 */
export function normalizeCart(items) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'No items provided');
  if (items.length > MAX_LINES) throw new HttpError(400, 'Too many cart lines');

  return items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new HttpError(400, `Invalid item at position ${index + 1}`);

    const productId = Number(item.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new HttpError(400, `Invalid product id at position ${index + 1}`);
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new HttpError(400, `Invalid quantity at position ${index + 1}`);
    }

    // Never let the client lower the surcharge: use the larger of the declared count and
    // the count derived from the submitted design JSON.
    const declared = Number(item.designElementCount);
    const declaredCount = Number.isInteger(declared) && declared > 0 ? declared : 0;
    const designElementCount = Math.max(declaredCount, countDesignElementsFromRaw(item.customDesignRaw));
    if (designElementCount > MAX_DESIGN_ELEMENTS) {
      throw new HttpError(400, `Too many design elements at position ${index + 1}`);
    }

    return {
      productId,
      isCustom: productId === CUSTOM_PRODUCT_ID,
      quantity,
      designElementCount,
      color: cleanString(item.color, 100),
      size: cleanString(item.size, 50),
    };
  });
}

/** Stable fingerprint of the price-relevant cart content (stored on the PaymentIntent). */
export function cartHash(lines) {
  const canonical = lines.map((l) => [l.productId, l.quantity, l.designElementCount]);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').substring(0, 40);
}

function toCents(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function formatCents(cents) {
  return (cents / 100).toFixed(2);
}

/**
 * Loads the WooCommerce products referenced by the cart (server credentials).
 * Returns Map<productId, product>.
 */
async function loadProducts(wc, productIds) {
  const ids = [...new Set(productIds)];
  const map = new Map();
  if (ids.length === 0) return map;
  const products = await wcRequest(
    wc,
    `products?include=${ids.join(',')}&per_page=100&_fields=id,name,status,price,regular_price,purchasable`,
  );
  for (const p of Array.isArray(products) ? products : []) map.set(Number(p.id), p);
  return map;
}

/**
 * Validates + prices a cart server-side.
 * @returns {{ lines, subtotalCents, shippingCents, totalCents, hash }}
 */
export async function quoteCart(wc, items) {
  const lines = normalizeCart(items);
  const products = await loadProducts(
    wc,
    lines.filter((l) => !l.isCustom).map((l) => l.productId),
  );

  const priced = lines.map((line, index) => {
    let baseCents;
    let productName;
    if (line.isCustom) {
      baseCents = CUSTOM_PRODUCT_PRICE_CENTS;
      productName = CUSTOM_PRODUCT_NAME;
    } else {
      const product = products.get(line.productId);
      if (!product || product.status !== 'publish' || product.purchasable === false) {
        throw new HttpError(400, `Product at position ${index + 1} is not available`);
      }
      // Same source the frontend uses (productMapper.ts): price || regular_price
      baseCents = toCents(product.price || product.regular_price || '0');
      if (!Number.isFinite(baseCents) || baseCents <= 0) {
        throw new HttpError(400, `Product at position ${index + 1} has no price`);
      }
      productName = cleanString(product.name, 200) || `Produkt ${line.productId}`;
    }
    const unitCents = baseCents + line.designElementCount * DESIGN_ELEMENT_CENTS;
    return { ...line, productName, baseCents, unitCents, lineCents: unitCents * line.quantity };
  });

  const subtotalCents = priced.reduce((sum, l) => sum + l.lineCents, 0);
  const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;
  return {
    lines: priced,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    hash: cartHash(lines),
  };
}
