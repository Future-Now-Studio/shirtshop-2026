// End-to-end test of the DEPLOYED edge functions:
//  1. create-payment-intent  -> clientSecret + amount (verifies shipping math)
//  2. confirm PI client-side with test card pm_card_visa (publishable key)
//  3. create-order            -> order row + items + design_data + stock decrement
// Uploads a fake design set to order-designs/<designId>/ first so the admin has
// files to show. Uses only anon + publishable keys locally (no secret needed).
import { admin } from "./checks/_clients.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const PK = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
const FN = (name) => `${SUPABASE_URL}/functions/v1/${name}`;
const invoke = async (name, body) => {
  const r = await fetch(FN(name), { method: "POST", headers: { Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
};

// pick a real published variant + size with stock
const { data: prod } = await admin.from("products").select("id,name,base_price,design_element_price").eq("status", "published").limit(1).single();
const { data: variant } = await admin.from("variants").select("id,colors(name)").eq("product_id", prod.id).limit(1).single();
const { data: avail } = await admin.from("variant_size_availability").select("size_id,stock").eq("variant_id", variant.id).limit(1).single();
const sizeId = avail?.size_id ?? null;
const stockBefore = avail?.stock ?? null;
console.log(`Produkt: ${prod.name} / ${variant.colors?.name} / size ${sizeId} — Bestand vorher: ${stockBefore}`);

// upload a fake design set (composite + 2 elements) to order-designs/<designId>/
const designId = crypto.randomUUID();
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"), c => c.charCodeAt(0));
for (const f of ["composite.png", "design-only.png", "element-1-text.png", "element-2-image.png"]) {
  await admin.storage.from("order-designs").upload(`${designId}/${f}`, png, { contentType: "image/png", upsert: true });
}
const manifest = [{ type: "text", file: "element-1-text.png", content: "TESTDRUCK" }, { type: "image", file: "element-2-image.png" }];
console.log(`Design hochgeladen: order-designs/${designId}/ (4 Dateien)`);

const item = { productId: prod.id, variantId: variant.id, sizeId, qty: 2, designElementCount: 2, designId, designManifest: manifest };

// 1) create-payment-intent
const pi = await invoke("create-payment-intent", { items: [item] });
console.log("\n[1] create-payment-intent:", pi.status, "amount(cents):", pi.body?.amount);
if (!pi.body?.clientSecret) { console.log("FEHLER:", pi.body); process.exit(1); }
const goods = (Number(prod.base_price) + 2 * Number(prod.design_element_price)) * 2;
console.log(`    erwartet: Ware ${goods.toFixed(2)} + Versand ${goods >= 50 ? 0 : 4.9} = ${(goods + (goods >= 50 ? 0 : 4.9)).toFixed(2)} €`);

// 2) confirm PI client-side with test card (publishable key + client_secret)
const piId = pi.body.clientSecret.split("_secret_")[0];
const form = new URLSearchParams({ client_secret: pi.body.clientSecret, payment_method: "pm_card_visa", "expand[]": "status" });
const conf = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}/confirm`, {
  method: "POST", headers: { Authorization: `Bearer ${PK}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form,
});
const confJson = await conf.json();
console.log("\n[2] confirm:", conf.status, "PI-Status:", confJson.status, confJson.error?.message ?? "");
if (confJson.status !== "succeeded") { console.log("FEHLER confirm:", JSON.stringify(confJson).slice(0, 300)); process.exit(1); }

// 3) create-order
const order = await invoke("create-order", {
  paymentIntentId: piId,
  customer: { name: "Test Kunde", email: "test@example.com", address: { line1: "Teststr. 1", postal_code: "20095", city: "Hamburg", country: "DE" } },
  items: [item],
});
console.log("\n[3] create-order:", order.status, JSON.stringify(order.body));
if (!order.body?.orderId) { console.log("FEHLER:", order.body); process.exit(1); }

// verify DB
const { data: oi } = await admin.from("order_items").select("qty,unit_price,design_data").eq("order_id", order.body.orderId);
const { data: availAfter } = sizeId ? await admin.from("variant_size_availability").select("stock").eq("variant_id", variant.id).eq("size_id", sizeId).single() : { data: null };
console.log("\n=== VERIFIKATION ===");
console.log("order_items:", oi?.length, "| design_data.designId:", oi?.[0]?.design_data?.designId === designId ? "✓ passt" : "✗", "| manifest-Elemente:", oi?.[0]?.design_data?.manifest?.length);
console.log("Bestand:", stockBefore, "->", availAfter?.stock, stockBefore != null && availAfter ? (availAfter.stock === Math.max(0, stockBefore - 2) ? "✓ -2" : "✗") : "(kein Size)");
console.log("Order-ID:", order.body.orderId, "Total:", order.body.total, "€  itemCount:", order.body.itemCount);
