// Creates a Stripe PaymentIntent. The authoritative amount is recomputed
// server-side from the database in `create-order`; here we create an intent
// for the client-reported total so the payment sheet can render. The order is
// only persisted after payment via create-order, which re-validates pricing.
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

// Recompute the authoritative total from DB prices + volume discounts.
async function computeTotal(items: { productId: string; variantId: string; qty: number; designElementCount: number }[]) {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const { data: products } = await supabase
    .from("products")
    .select("id, base_price, design_element_price, excluded_from_volume_discount")
    .in("id", productIds);
  const { data: discounts } = await supabase.from("volume_discounts").select("min_qty, discount_percent");
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  let subtotal = 0;
  let eligibleQty = 0;
  let eligibleSubtotal = 0;
  for (const i of items) {
    const p = byId.get(i.productId);
    if (!p) throw new Error(`Unknown product ${i.productId}`);
    const unit = Number(p.base_price) + i.designElementCount * Number(p.design_element_price);
    const line = unit * i.qty;
    subtotal += line;
    if (!p.excluded_from_volume_discount) {
      eligibleQty += i.qty;
      eligibleSubtotal += line;
    }
  }
  const tier = (discounts ?? []).filter((d) => d.min_qty <= eligibleQty).sort((a, b) => b.min_qty - a.min_qty)[0];
  const pct = tier?.discount_percent ?? 0;
  const total = subtotal - (eligibleSubtotal * pct) / 100;
  return Math.round(total * 100); // cents
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) return json({ error: "No items" }, 400);

    const amount = await computeTotal(items);
    if (amount <= 0) return json({ error: "Invalid amount" }, 400);

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
    });
    return json({ clientSecret: intent.client_secret, amount });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
