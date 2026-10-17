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

const REFUNDABLE = ["paid", "in_production", "shipped", "completed"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);
    const { orderId } = await req.json();
    if (!orderId) return json({ error: "Missing orderId" }, 400);

    const { data: order, error } = await supabase
      .from("orders").select("id, status, stripe_payment_intent_id").eq("id", orderId).single();
    if (error) throw error;
    if (order.status === "refunded") return json({ error: "Already refunded" }, 400);
    if (!REFUNDABLE.includes(order.status)) return json({ error: `Status ${order.status} kann nicht erstattet werden` }, 400);
    if (!order.stripe_payment_intent_id) return json({ error: "No payment to refund" }, 400);

    // Full Stripe refund. The idempotency key makes retries / double clicks
    // return the same refund instead of failing or refunding twice.
    // Idempotency keys expire after 24h; a later retry gets
    // charge_already_refunded, which still means the money is back.
    try {
      await stripe.refunds.create(
        { payment_intent: order.stripe_payment_intent_id },
        { idempotencyKey: `refund-${order.id}` },
      );
    } catch (e) {
      if ((e as any)?.code !== "charge_already_refunded") throw e;
    }

    // Status change + stock restore in one transaction, at most once.
    const { error: markErr } = await supabase.rpc("mark_order_refunded", { p_order_id: order.id });
    if (markErr) throw markErr;

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Erstattung fehlgeschlagen" }, 500);
  }
});
