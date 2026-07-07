// Single source of truth for shipping + VAT. The Edge Functions
// (create-payment-intent, create-order) duplicate these three constants —
// keep them in sync (they can't import from src/).
export const SHIPPING_FLAT = 4.9;          // € flat shipping
export const FREE_SHIPPING_THRESHOLD = 50; // € goods total for free shipping
export const VAT_RATE = 0.19;              // 19% German VAT, already included in gross prices

/** Shipping cost for a given goods total (after discount). */
export function shippingFor(goodsTotal: number): number {
  return goodsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
}

/** VAT amount contained in a gross (VAT-inclusive) price. */
export function vatIncludedIn(gross: number): number {
  return gross - gross / (1 + VAT_RATE);
}
