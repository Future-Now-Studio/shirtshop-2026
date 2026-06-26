// Persists an order after Stripe payment succeeds. Re-validates the payment
// with Stripe, recomputes the authoritative total from DB prices, stores the
// order + items, and uploads each design render PNG to the private
// design-renders bucket. Never trusts client-sent prices.
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const [head, b64] = dataUrl.split(",");
  const contentType = head.match(/data:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, contentType };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { items, customer, paymentIntentId } = await req.json();
    if (!Array.isArray(items) || items.length === 0) return json({ error: "No items" }, 400);
    if (!paymentIntentId) return json({ error: "Missing paymentIntentId" }, 400);

    // Verify payment really succeeded.
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") return json({ error: `Payment not completed (${intent.status})` }, 402);

    // Recompute authoritative prices from DB.
    const productIds = [...new Set(items.map((i: any) => i.productId))];
    const { data: products } = await supabase
      .from("products")
      .select("id, base_price, design_element_price, excluded_from_volume_discount")
      .in("id", productIds);
    const { data: discounts } = await supabase.from("volume_discounts").select("min_qty, discount_percent");
    const byId = new Map((products ?? []).map((p) => [p.id, p]));

    let subtotal = 0, eligibleQty = 0, eligibleSubtotal = 0;
    const lines = items.map((i: any) => {
      const p: any = byId.get(i.productId);
      if (!p) throw new Error(`Unknown product ${i.productId}`);
      const unit = Number(p.base_price) + (i.designElementCount ?? 0) * Number(p.design_element_price);
      const line = unit * i.qty;
      subtotal += line;
      if (!p.excluded_from_volume_discount) { eligibleQty += i.qty; eligibleSubtotal += line; }
      return { item: i, unit };
    });
    const tier = (discounts ?? []).filter((d) => d.min_qty <= eligibleQty).sort((a, b) => b.min_qty - a.min_qty)[0];
    const total = subtotal - (eligibleSubtotal * (tier?.discount_percent ?? 0)) / 100;

    // Create the order.
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        status: "paid",
        customer_name: customer?.name ?? null,
        customer_email: customer?.email ?? null,
        customer_address: customer?.address ?? null,
        total: total.toFixed(2),
        stripe_payment_intent_id: paymentIntentId,
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    // Insert items + upload design renders.
    for (const { item, unit } of lines) {
      const renderPaths: string[] = [];
      const renders = item.designRenders ?? {};
      for (const [view, dataUrl] of Object.entries(renders)) {
        try {
          const { bytes, contentType } = dataUrlToBytes(dataUrl as string);
          const path = `${order.id}/${item.variantId}-${view}.png`;
          const { error: upErr } = await supabase.storage.from("design-renders").upload(path, bytes, {
            contentType,
            upsert: true,
          });
          if (!upErr) renderPaths.push(path);
        } catch { /* skip bad render */ }
      }
      await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        size_id: item.sizeId,
        qty: item.qty,
        unit_price: unit.toFixed(2),
        design_data: item.designData ? JSON.parse(item.designData) : null,
        design_render_paths: renderPaths,
      });
    }

    return json({ orderId: order.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
