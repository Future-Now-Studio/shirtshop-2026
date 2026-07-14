// Persists an order after Stripe payment succeeds. Re-validates the payment
// with Stripe, recomputes the authoritative total from DB prices, stores the
// order + items, and uploads each design render PNG to the private
// design-renders bucket. Never trusts client-sent prices.
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { validateCoupon } from "../_shared/coupon.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Sends an order-received email to the shop owner via Resend (if configured).
async function sendOrderEmail(order: any, lines: any[], total: number, itemCount: number) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return; // email not configured — skip silently

  const { data: settings } = await supabase.from("settings").select("order_email").eq("id", 1).single();
  const to = Deno.env.get("ORDER_EMAIL_TO") || settings?.order_email;
  if (!to) return;

  const rows = lines
    .map((l: any) => `<tr><td>${l.item.qty}×</td><td>${l.item.productId}</td><td>${(l.unit * l.item.qty).toFixed(2)} €</td></tr>`)
    .join("");
  const html = `
    <h2>Neue Bestellung</h2>
    <p><b>Kunde:</b> ${order.customer_name ?? "—"} (${order.customer_email ?? "—"})</p>
    <p><b>Positionen:</b> ${itemCount} Stück · <b>Gesamt:</b> ${total.toFixed(2)} €</p>
    <table cellpadding="6" border="1" style="border-collapse:collapse">${rows}</table>
    <p>Bestell-ID: ${order.id}. Design-Dateien im Admin unter Bestellungen.</p>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("ORDER_EMAIL_FROM") || "Private Shirt <onboarding@resend.dev>",
      to: [to],
      subject: `Neue Bestellung – ${total.toFixed(2)} €`,
      html,
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { items, customer, paymentIntentId, couponCode } = await req.json();
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
    let goodsTotal = subtotal - (eligibleSubtotal * (tier?.discount_percent ?? 0)) / 100;
    const { discount: couponDiscount, coupon } = await validateCoupon(supabase, couponCode, goodsTotal);
    goodsTotal -= couponDiscount;
    // Shipping — keep in sync with src/lib/pricing.ts
    const shipping = goodsTotal >= 50 ? 0 : 4.9;
    const total = goodsTotal + shipping; // VAT already included in gross prices

    // Create the order.
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        status: "paid",
        customer_name: customer?.name ?? null,
        customer_email: customer?.email ?? null,
        customer_address: customer?.address ?? null,
        total: total.toFixed(2),
        discount_amount: couponDiscount.toFixed(2),
        coupon_code: coupon?.code ?? null,
        stripe_payment_intent_id: paymentIntentId,
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    // Count coupon usage (best effort).
    if (coupon) {
      await supabase.from("coupons").update({ used_count: (coupon.used_count ?? 0) + 1 }).eq("id", coupon.id);
    }

    // Insert items. Design media already lives in the order-designs bucket under
    // item.designId; we store the id + manifest so the admin can list every file.
    let itemCount = 0;
    for (const { item, unit } of lines) {
      itemCount += item.qty;
      await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        size_id: item.sizeId,
        qty: item.qty,
        unit_price: unit.toFixed(2),
        design_data: item.designId ? { designId: item.designId, manifest: item.designManifest ?? [] } : null,
        design_render_paths: [],
      });

      // Decrement stock for this variant+size (best effort).
      if (item.sizeId) {
        const { data: av } = await supabase
          .from("variant_size_availability")
          .select("stock")
          .eq("variant_id", item.variantId)
          .eq("size_id", item.sizeId)
          .single();
        if (av) {
          const next = Math.max(0, (av.stock ?? 0) - item.qty);
          await supabase
            .from("variant_size_availability")
            .update({ stock: next, available: next > 0 })
            .eq("variant_id", item.variantId)
            .eq("size_id", item.sizeId);
        }
      }
    }

    // notify shop owner by email (best effort — never blocks the order)
    try {
      await sendOrderEmail(order, lines, total, itemCount);
    } catch (_) { /* ignore email errors */ }

    return json({ orderId: order.id, total: total.toFixed(2), itemCount });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
