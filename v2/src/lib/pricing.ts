// Storefront pricing. Shipping + VAT come from the admin settings via the
// public shop_config() RPC — the same values create-payment-intent charges —
// with these defaults only as a fallback while loading.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { unitPrice, type CartItem } from "@/stores/cart";
import { eur } from "@/lib/utils";

export interface ShopConfig {
  shippingFlat: number;            // € flat shipping
  freeShippingThreshold: number;   // € goods total for free shipping
  vatRate: number;                 // VAT, already included in gross prices
  deliveryTime: string;            // Lieferzeit text, e.g. "3–5 Werktage"
}

export const DEFAULT_SHOP_CONFIG: ShopConfig = {
  shippingFlat: 4.9,
  freeShippingThreshold: 50,
  vatRate: 0.19,
  deliveryTime: "3–5 Werktage, mit individuellem Druck 5–10 Werktage",
};

export async function fetchShopConfig(): Promise<ShopConfig> {
  const { data, error } = await supabase.rpc("shop_config");
  if (error || !data) return DEFAULT_SHOP_CONFIG;
  const d = data as Record<string, number | string>;
  return {
    shippingFlat: Number(d.shipping_flat ?? DEFAULT_SHOP_CONFIG.shippingFlat),
    freeShippingThreshold: Number(d.free_shipping_threshold ?? DEFAULT_SHOP_CONFIG.freeShippingThreshold),
    vatRate: Number(d.vat_rate ?? DEFAULT_SHOP_CONFIG.vatRate),
    deliveryTime: String(d.delivery_time || DEFAULT_SHOP_CONFIG.deliveryTime),
  };
}

export function useShopConfig(): ShopConfig {
  const { data } = useQuery({ queryKey: ["shop-config"], queryFn: fetchShopConfig, staleTime: 5 * 60_000 });
  return data ?? DEFAULT_SHOP_CONFIG;
}

/** Shipping cost for a given goods total (after discount). */
export function shippingFor(goodsTotal: number, cfg: ShopConfig = DEFAULT_SHOP_CONFIG): number {
  return goodsTotal >= cfg.freeShippingThreshold ? 0 : cfg.shippingFlat;
}

/** VAT amount contained in a gross (VAT-inclusive) price. */
export function vatIncludedIn(gross: number, cfg: ShopConfig = DEFAULT_SHOP_CONFIG): number {
  return gross - gross / (1 + cfg.vatRate);
}

export const vatLabel = (cfg: ShopConfig) => `${Math.round(cfg.vatRate * 100)}%`;

/** PAngV notice shown next to every product price. */
export const PRICE_NOTE = "inkl. MwSt., zzgl. Versand";
export const shippingNote = (cfg: ShopConfig) =>
  `Versand ${eur(cfg.shippingFlat)}, ab ${eur(cfg.freeShippingThreshold)} versandkostenfrei`;

export interface CurrentPrice {
  basePrice: number;
  designElementPrice: number;
}

/**
 * Volume-discount tiers + products excluded from them, plus shop config and
 * the current catalogue prices of the given products (only published ones
 * are listed in `prices`; a missing product is no longer for sale).
 */
export async function fetchDiscountData(productIds: string[]) {
  const [discounts, products, cfg] = await Promise.all([
    supabase.from("volume_discounts").select("min_qty, discount_percent").order("min_qty"),
    productIds.length
      ? supabase.from("products")
          .select("id, excluded_from_volume_discount, base_price, design_element_price, status")
          .in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    fetchShopConfig(),
  ]);
  if (discounts.error) throw discounts.error;
  if (products.error) throw products.error;
  const prices: Record<string, CurrentPrice> = {};
  for (const p of products.data ?? []) {
    if (p.status !== "published") continue;
    prices[p.id] = { basePrice: Number(p.base_price), designElementPrice: Number(p.design_element_price) };
  }
  return {
    discounts: discounts.data.map((d) => ({ min_qty: d.min_qty, discount_percent: Number(d.discount_percent) })),
    excluded: new Set(products.data!.filter((p) => p.excluded_from_volume_discount).map((p) => p.id)),
    prices,
    cfg,
  };
}

const cents = (eur: number) => Math.round(eur * 100);

/**
 * Client-side preview of the totals; the server recomputes authoritatively.
 * Same integer-cent rounding as create-payment-intent, so both agree.
 */
export function computeTotals(
  items: CartItem[],
  discounts: { min_qty: number; discount_percent: number }[],
  excluded: Set<string>,
  cfg: ShopConfig = DEFAULT_SHOP_CONFIG,
) {
  const lineCents = (i: CartItem) => cents(unitPrice(i)) * i.qty;
  const eligible = items.filter((i) => !excluded.has(i.productId));
  const subtotalCents = items.reduce((s, i) => s + lineCents(i), 0);
  const eligibleQty = eligible.reduce((s, i) => s + i.qty, 0);
  const eligibleCents = eligible.reduce((s, i) => s + lineCents(i), 0);
  const tier = [...discounts].filter((d) => d.min_qty <= eligibleQty).sort((a, b) => b.min_qty - a.min_qty)[0];
  const pct = Number(tier?.discount_percent ?? 0);
  const discountCents = Math.round((eligibleCents * pct) / 100);
  const subtotal = subtotalCents / 100;
  const discount = discountCents / 100;
  const goodsTotal = (subtotalCents - discountCents) / 100;
  const shipping = shippingFor(goodsTotal, cfg);
  const grandTotal = (subtotalCents - discountCents + cents(shipping)) / 100;
  const vat = vatIncludedIn(grandTotal, cfg);
  return { subtotal, eligibleQty, pct, discount, goodsTotal, shipping, grandTotal, vat, total: grandTotal, cfg };
}

/**
 * Next volume-discount tier above `eligibleQty` (for "Noch N Stück bis X %
 * Mengenrabatt"), or null when the highest tier is reached.
 */
export function nextVolumeTier(
  eligibleQty: number,
  discounts: { min_qty: number; discount_percent: number }[],
): { missing: number; pct: number } | null {
  const next = [...discounts].filter((d) => d.min_qty > eligibleQty).sort((a, b) => a.min_qty - b.min_qty)[0];
  return next ? { missing: next.min_qty - eligibleQty, pct: Number(next.discount_percent) } : null;
}
