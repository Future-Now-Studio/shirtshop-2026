// Refunds an order in full via Stripe, restores stock, sets status=refunded.
// Admin-triggered. Requires STRIPE_SECRET_KEY.
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);
    const { orderId } = await req.json();
    if (!orderId) return json({ error: "Missing orderId" }, 400);

    const { data: order, error } = await supabase
      .from("orders").select("id, status, stripe_payment_intent_id, order_items(variant_id, size_id, qty)").eq("id", orderId).single();
    if (error) throw error;
    if (order.status === "refunded") return json({ error: "Already refunded" }, 400);
    if (!order.stripe_payment_intent_id) return json({ error: "No payment to refund" }, 400);

    // Stripe refund (full)
    await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id });

    // Restore stock
    for (const it of order.order_items ?? []) {
      if (!it.variant_id || !it.size_id) continue;
      const { data: av } = await supabase.from("variant_size_availability")
        .select("stock").eq("variant_id", it.variant_id).eq("size_id", it.size_id).single();
      if (av) {
        await supabase.from("variant_size_availability")
          .update({ stock: (av.stock ?? 0) + it.qty, available: true })
          .eq("variant_id", it.variant_id).eq("size_id", it.size_id);
      }
    }

    await supabase.from("orders").update({ status: "refunded" }).eq("id", orderId);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
