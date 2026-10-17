// Shared cart validation + pricing for create-payment-intent and create-order.
// Every client-sent field is validated here; prices come only from the DB.
import { validateCoupon } from "./coupon.ts";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface CartLine {
  productId: string;
  variantId: string;
  sizeId: string | null;
  qty: number;
  designElementCount: number;
  designId: string | null;
  designManifest: unknown[];
}

const MAX_LINES = 50;
const MAX_QTY = 1000;
const MAX_DESIGN_ELEMENTS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isInt = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Shape-validates the raw request items. Throws HttpError(400) on bad input. */
export function parseItems(raw: unknown): CartLine[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, "Warenkorb ist leer.");
  if (raw.length > MAX_LINES) throw new HttpError(400, "Zu viele Positionen.");
  return raw.map((i: any) => {
    if (typeof i?.productId !== "string" || !UUID.test(i.productId)) throw new HttpError(400, "Ungültiges Produkt.");
    if (typeof i.variantId !== "string" || !UUID.test(i.variantId)) throw new HttpError(400, "Ungültige Variante.");
    if (i.sizeId != null && (typeof i.sizeId !== "string" || !UUID.test(i.sizeId))) throw new HttpError(400, "Ungültige Größe.");
    if (!isInt(i.qty, 1, MAX_QTY)) throw new HttpError(400, "Ungültige Menge.");
    const designElementCount = i.designElementCount ?? 0;
    if (!isInt(designElementCount, 0, MAX_DESIGN_ELEMENTS)) throw new HttpError(400, "Ungültige Anzahl Design-Elemente.");
    if (i.designId != null && (typeof i.designId !== "string" || i.designId.length > 100)) throw new HttpError(400, "Ungültiges Design.");
    return {
      productId: i.productId,
      variantId: i.variantId,
      sizeId: i.sizeId ?? null,
      qty: i.qty,
      designElementCount,
      designId: i.designId ?? null,
      designManifest: Array.isArray(i.designManifest) ? i.designManifest : [],
    };
  });
}

export interface Customer {
  name: string;
  email: string;
  address: { line1: string; postal_code: string; city: string; country: string };
}

/** Validates the checkout customer form. Throws HttpError(400) on bad input. */
export function parseCustomer(raw: any): Customer {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim() : "").slice(0, max);
  const c = {
    name: str(raw?.name, 200),
    email: str(raw?.email, 200),
    address: {
      line1: str(raw?.address?.line1, 300),
      postal_code: str(raw?.address?.postal_code, 20),
      city: str(raw?.address?.city, 100),
      country: str(raw?.address?.country, 2).toUpperCase() || "DE",
    },
  };
  if (!c.name || !c.address.line1 || !c.address.postal_code || !c.address.city) {
    throw new HttpError(400, "Bitte Name und vollständige Adresse angeben.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) throw new HttpError(400, "Bitte gültige E-Mail-Adresse angeben.");
  return c;
}

/**
 * Stable hash of everything that determines the price. create-payment-intent
 * stores it in the PaymentIntent metadata; create-order only accepts a cart
 * with the same hash, so nobody can pay for one cart and order another.
 */
export async function cartHash(lines: CartLine[]): Promise<string> {
  const canonical = lines
    .map((l) => [l.productId, l.variantId, l.sizeId ?? "", l.qty, l.designElementCount].join("|"))
    .sort()
    .join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Checks every line against the catalog (published product, variant belongs to
 * the product, size offered for the product) and returns the DB unit price per
 * line (same order as `lines`). `requirePublished: false` is for already-paid
 * carts, where a product unpublished after payment must not block the order.
 */
export async function priceLines(supabase: any, lines: CartLine[], { requirePublished = true } = {}) {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const variantIds = [...new Set(lines.map((l) => l.variantId))];
  const [{ data: products, error: pErr }, { data: variants, error: vErr }, { data: sizes, error: sErr }] = await Promise.all([
    supabase.from("products")
      .select("id, name, base_price, design_element_price, excluded_from_volume_discount, status")
      .in("id", productIds),
    supabase.from("variants").select("id, product_id").in("id", variantIds),
    supabase.from("product_sizes").select("product_id, size_id").in("product_id", productIds),
  ]);
  if (pErr || vErr || sErr) throw pErr ?? vErr ?? sErr;

  const productById = new Map((products ?? []).map((p: any) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v: any) => [v.id, v]));
  const offeredSizes = new Set((sizes ?? []).map((s: any) => `${s.product_id}:${s.size_id}`));

  return lines.map((l) => {
    const p: any = productById.get(l.productId);
    if (!p || (requirePublished && p.status !== "published")) throw new HttpError(400, "Ein Produkt ist nicht mehr verfügbar.");
    const v: any = variantById.get(l.variantId);
    if (!v || v.product_id !== l.productId) throw new HttpError(400, "Ungültige Variante.");
    if (l.sizeId && !offeredSizes.has(`${l.productId}:${l.sizeId}`)) throw new HttpError(400, "Ungültige Größe.");
    const unit = Number(p.base_price) + l.designElementCount * Number(p.design_element_price);
    return { line: l, unit, name: String(p.name), excluded: !!p.excluded_from_volume_discount };
  });
}

/** Authoritative total: DB prices + volume discount + coupon + shipping. */
export async function computeTotal(supabase: any, lines: CartLine[], couponCode?: string | null) {
  const priced = await priceLines(supabase, lines);
  const [{ data: discounts }, { data: cfg }] = await Promise.all([
    supabase.from("volume_discounts").select("min_qty, discount_percent"),
    supabase.from("settings").select("shipping_flat, free_shipping_threshold").eq("id", 1).maybeSingle(),
  ]);

  let subtotal = 0, eligibleQty = 0, eligibleSubtotal = 0;
  for (const { line, unit, excluded } of priced) {
    subtotal += unit * line.qty;
    if (!excluded) { eligibleQty += line.qty; eligibleSubtotal += unit * line.qty; }
  }
  const tier = (discounts ?? [])
    .filter((d: any) => d.min_qty <= eligibleQty)
    .sort((a: any, b: any) => b.min_qty - a.min_qty)[0];
  const volumeDiscount = (eligibleSubtotal * (tier?.discount_percent ?? 0)) / 100;
  let goodsTotal = subtotal - volumeDiscount;
  const { discount, coupon, reason } = await validateCoupon(supabase, couponCode, goodsTotal);
  goodsTotal -= discount;
  const freeFrom = Number(cfg?.free_shipping_threshold ?? 50);
  const shipping = goodsTotal >= freeFrom ? 0 : Number(cfg?.shipping_flat ?? 4.9);
  const amount = Math.round((goodsTotal + shipping) * 100); // cents, VAT already included
  return { amount, discount, volumeDiscount, shipping, coupon, couponReason: reason, priced };
}

/** Maps any error to a response body; internal errors are not leaked. */
export function errorResponse(e: unknown): { body: { error: string }; status: number } {
  if (e instanceof HttpError) return { body: { error: e.message }, status: e.status };
  console.error(e);
  return { body: { error: "Interner Fehler. Bitte später erneut versuchen." }, status: 500 };
}
