// Shared cart validation + pricing for create-payment-intent and create-order.
// Every client-sent field is validated here; prices come only from the DB.
// All money math runs in integer cents, so the stored parts (goods, volume
// discount, coupon, shipping) always add up to the charged amount.
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

/** Euro amount (number or numeric string) → integer cents. */
export const toCents = (eur: unknown) => Math.round(Number(eur ?? 0) * 100);

// Manifest entries are display data for the admin (one per element file);
// keep only small primitive fields so nobody can store megabytes here. The
// print keys are what the designer writes per element (Designer.tsx).
const MANIFEST_KEYS = [
  "view", "index", "type", "text", "fontFamily", "fontRendered", "fill", "left", "top", "width", "height", "angle",
  "file", "printFile", "printCmW", "printCmH", "printDpi", "zone", "clipped", "cmLeft", "cmTop", "cmWidth", "cmHeight",
  "sizeEstimated", "original", "sourceW", "sourceH", "dpi", "approvedAt",
];
function sanitizeManifest(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_DESIGN_ELEMENTS).map((m: any) => {
    const out: Record<string, string | number | boolean> = {};
    for (const k of MANIFEST_KEYS) {
      const v = m?.[k];
      if (typeof v === "string") out[k] = v.slice(0, 300);
      else if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean") out[k] = v;
    }
    return out;
  });
}

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
    if (i.designId != null && (typeof i.designId !== "string" || !UUID.test(i.designId))) throw new HttpError(400, "Ungültiges Design.");
    // Design elements are billed per element of a stored design: a count
    // needs a design, and a design has at least one element.
    if ((designElementCount > 0) !== (i.designId != null)) throw new HttpError(400, "Ungültiges Design.");
    return {
      productId: i.productId,
      variantId: i.variantId,
      sizeId: i.sizeId ?? null,
      qty: i.qty,
      designElementCount,
      designId: i.designId ?? null,
      designManifest: sanitizeManifest(i.designManifest),
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
  // Shipping, VAT and the invoice assume a German address (the shop only
  // delivers within Germany) — reject anything else instead of mispricing it.
  if (c.address.country !== "DE") throw new HttpError(400, "Wir liefern nur innerhalb Deutschlands.");
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
  return sha256Hex(canonical);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Design verification ------------------------------------------------------
// The designer stores order-designs/<designId>/design.json: an object keyed by
// view, each { objects: [...] } (Fabric JSON), print-zone guides marked
// __zone:true. Billable elements = objects without __zone across all views.
const DESIGN_BUCKET = "order-designs";
const MAX_DESIGN_JSON_BYTES = 25 * 1024 * 1024; // bucket file limit
const MAX_DESIGN_BYTES_PER_REQUEST = 60 * 1024 * 1024;
const MAX_DESIGNS_PER_REQUEST = 20;
const DESIGN_MISMATCH =
  "Ein Design in deinem Warenkorb ist unvollständig oder wurde verändert. Bitte entferne die Position und füge dein Design neu hinzu.";

/** Billable elements in a parsed design.json, or -1 if it has the wrong shape. */
export function countDesignElements(design: unknown): number {
  if (!design || typeof design !== "object" || Array.isArray(design)) return -1;
  let n = 0;
  for (const view of Object.values(design as Record<string, any>)) {
    const objects = view?.objects;
    if (Array.isArray(objects)) n += objects.filter((o: any) => !o?.__zone).length;
  }
  return n;
}

/**
 * Recomputes the element count of every referenced design from its stored
 * design.json (service role) and rejects carts whose count differs, so the
 * element price cannot be skipped by editing the cart. Each design is read
 * once, with a size cap. Also rejects folders holding more element files than
 * the design has elements.
 */
export async function verifyDesigns(supabase: any, lines: CartLine[]) {
  const byDesign = new Map<string, CartLine[]>();
  for (const l of lines) {
    if (!l.designId) continue;
    byDesign.set(l.designId, [...(byDesign.get(l.designId) ?? []), l]);
  }
  if (byDesign.size > MAX_DESIGNS_PER_REQUEST) {
    throw new HttpError(400, "Zu viele verschiedene Designs in einer Bestellung. Bitte teile sie auf mehrere Bestellungen auf.");
  }

  let budget = MAX_DESIGN_BYTES_PER_REQUEST;
  for (const [designId, group] of byDesign) {
    const { data: files, error: listErr } = await supabase.storage.from(DESIGN_BUCKET).list(designId, { limit: 1000 });
    if (listErr) throw listErr;
    const json = (files ?? []).find((f: any) => f.name === "design.json");
    if (!json) throw new HttpError(400, DESIGN_MISMATCH);
    const size = Number(json.metadata?.size ?? 0);
    if (size > MAX_DESIGN_JSON_BYTES || size > budget) {
      throw new HttpError(400, "Deine Designs sind zu groß für eine Bestellung. Bitte teile sie auf mehrere Bestellungen auf.");
    }

    const { data: blob, error: dlErr } = await supabase.storage.from(DESIGN_BUCKET).download(`${designId}/design.json`);
    if (dlErr || !blob) throw dlErr ?? new Error(`design.json missing for ${designId}`);
    if (blob.size > MAX_DESIGN_JSON_BYTES || blob.size > budget) throw new HttpError(400, DESIGN_MISMATCH);
    budget -= blob.size;

    let count: number;
    try {
      count = countDesignElements(JSON.parse(await blob.text()));
    } catch {
      count = -1;
    }
    // Per-element print files (the designer writes <view>-element-<n>.png).
    // Counted like the admin's "Einzel-Elemente" list: every name with "element".
    const elementFiles = (files ?? []).filter((f: any) => /element/i.test(String(f.name))).length;
    if (count < 1 || elementFiles > count || group.some((l) => l.designElementCount !== count)) {
      console.warn(`design ${designId}: stored ${count} elements / ${elementFiles} files, cart ${group.map((l) => l.designElementCount).join(",")}`);
      throw new HttpError(400, DESIGN_MISMATCH);
    }
  }
}

// --- Pricing ------------------------------------------------------------------

export interface PricedLine {
  line: CartLine;
  unit: number; // € incl. VAT, exact to the cent
  name: string;
  excluded: boolean;
}

/**
 * Checks every line against the catalog (published product, variant belongs to
 * the product, size offered for the product and chosen when the product has
 * sizes) and returns the DB unit price per line (same order as `lines`).
 * `requirePublished: false` is for already-paid carts, where a product
 * unpublished after payment must not block the order.
 */
export async function priceLines(supabase: any, lines: CartLine[], { requirePublished = true } = {}): Promise<PricedLine[]> {
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
  const sizedProducts = new Set((sizes ?? []).map((s: any) => s.product_id));

  return lines.map((l) => {
    const p: any = productById.get(l.productId);
    if (!p || (requirePublished && p.status !== "published")) throw new HttpError(400, "Ein Produkt ist nicht mehr verfügbar.");
    const v: any = variantById.get(l.variantId);
    if (!v || v.product_id !== l.productId) throw new HttpError(400, "Ungültige Variante.");
    if (l.sizeId && !offeredSizes.has(`${l.productId}:${l.sizeId}`)) throw new HttpError(400, "Ungültige Größe.");
    // Before payment: stock is kept per size, so a sized product needs one.
    if (requirePublished && !l.sizeId && sizedProducts.has(l.productId)) {
      throw new HttpError(400, `Bitte wähle eine Größe für „${p.name}“.`);
    }
    const unitCents = toCents(p.base_price) + l.designElementCount * toCents(p.design_element_price);
    return { line: l, unit: unitCents / 100, name: String(p.name), excluded: !!p.excluded_from_volume_discount };
  });
}

/** Authoritative total: DB prices + volume discount + coupon + shipping. */
export async function computeTotal(supabase: any, lines: CartLine[], couponCode?: string | null) {
  const priced = await priceLines(supabase, lines);
  const [{ data: discounts, error: dErr }, { data: cfg, error: cErr }] = await Promise.all([
    supabase.from("volume_discounts").select("min_qty, discount_percent"),
    supabase.from("settings").select("shipping_flat, free_shipping_threshold").eq("id", 1).maybeSingle(),
  ]);
  if (dErr || cErr) throw dErr ?? cErr;

  let subtotal = 0, eligibleQty = 0, eligibleSubtotal = 0; // cents
  for (const { line, unit, excluded } of priced) {
    const lineCents = toCents(unit) * line.qty;
    subtotal += lineCents;
    if (!excluded) { eligibleQty += line.qty; eligibleSubtotal += lineCents; }
  }
  const tier = (discounts ?? [])
    .filter((d: any) => d.min_qty <= eligibleQty)
    .sort((a: any, b: any) => b.min_qty - a.min_qty)[0];
  const volumeDiscount = Math.round((eligibleSubtotal * Number(tier?.discount_percent ?? 0)) / 100);
  let goods = subtotal - volumeDiscount;
  const { discount, coupon, reason } = await validateCoupon(supabase, couponCode, goods);
  goods -= discount;
  const freeFrom = toCents(cfg?.free_shipping_threshold ?? 50);
  const shipping = goods >= freeFrom ? 0 : toCents(cfg?.shipping_flat ?? 4.9);
  const amount = goods + shipping; // cents, VAT already included
  return {
    amount,
    // € values, exact to the cent: subtotal − volumeDiscount − discount + shipping = amount / 100
    subtotal: subtotal / 100,
    volumeDiscount: volumeDiscount / 100,
    discount: discount / 100,
    shipping: shipping / 100,
    coupon,
    couponReason: reason,
    priced,
  };
}

/** Maps any error to a response body; internal errors are not leaked. */
export function errorResponse(e: unknown): { body: { error: string }; status: number } {
  if (e instanceof HttpError) return { body: { error: e.message }, status: e.status };
  console.error(e);
  return { body: { error: "Interner Fehler. Bitte später erneut versuchen." }, status: 500 };
}
