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
}

export const DEFAULT_SHOP_CONFIG: ShopConfig = { shippingFlat: 4.9, freeShippingThreshold: 50, vatRate: 0.19 };

export async function fetchShopConfig(): Promise<ShopConfig> {
  const { data, error } = await supabase.rpc("shop_config");
  if (error || !data) return DEFAULT_SHOP_CONFIG;
  const d = data as Record<string, number>;
  return {
    shippingFlat: Number(d.shipping_flat ?? DEFAULT_SHOP_CONFIG.shippingFlat),
    freeShippingThreshold: Number(d.free_shipping_threshold ?? DEFAULT_SHOP_CONFIG.freeShippingThreshold),
    vatRate: Number(d.vat_rate ?? DEFAULT_SHOP_CONFIG.vatRate),
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

/** Volume-discount tiers + products excluded from them, plus shop config. */
export async function fetchDiscountData(productIds: string[]) {
  const [discounts, products, cfg] = await Promise.all([
    supabase.from("volume_discounts").select("min_qty, discount_percent").order("min_qty"),
    productIds.length
      ? supabase.from("products").select("id, excluded_from_volume_discount").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    fetchShopConfig(),
  ]);
  if (discounts.error) throw discounts.error;
  if (products.error) throw products.error;
  return {
    discounts: discounts.data,
    excluded: new Set(products.data!.filter((p) => p.excluded_from_volume_discount).map((p) => p.id)),
    cfg,
  };
}

/** Client-side preview of the totals; the server recomputes authoritatively. */
export function computeTotals(
  items: CartItem[],
  discounts: { min_qty: number; discount_percent: number }[],
  excluded: Set<string>,
  cfg: ShopConfig = DEFAULT_SHOP_CONFIG,
) {
  const subtotal = items.reduce((s, i) => s + unitPrice(i) * i.qty, 0);
  const eligibleQty = items.filter((i) => !excluded.has(i.productId)).reduce((s, i) => s + i.qty, 0);
  const eligibleSubtotal = items.filter((i) => !excluded.has(i.productId)).reduce((s, i) => s + unitPrice(i) * i.qty, 0);
  const tier = [...discounts].filter((d) => d.min_qty <= eligibleQty).sort((a, b) => b.min_qty - a.min_qty)[0];
  const pct = tier?.discount_percent ?? 0;
  const discount = (eligibleSubtotal * pct) / 100;
  const goodsTotal = subtotal - discount;
  const shipping = shippingFor(goodsTotal, cfg);
  const grandTotal = goodsTotal + shipping;
  const vat = vatIncludedIn(grandTotal, cfg);
  return { subtotal, eligibleQty, pct, discount, goodsTotal, shipping, grandTotal, vat, total: grandTotal, cfg };
}
