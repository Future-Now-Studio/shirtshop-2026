// Creates a Stripe PaymentIntent. The authoritative amount is recomputed
// server-side from the database in `create-order`; here we create an intent
// for the client-reported total so the payment sheet can render. The order is
// only persisted after payment via create-order, which re-validates pricing.
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

// Recompute the authoritative total from DB prices + volume discounts + coupon.
async function computeTotal(items: { productId: string; variantId: string; qty: number; designElementCount: number }[], couponCode?: string) {
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
  let goodsTotal = subtotal - (eligibleSubtotal * pct) / 100;
  const { discount, reason } = await validateCoupon(supabase, couponCode, goodsTotal);
  goodsTotal -= discount;
  // Shipping — keep in sync with src/lib/pricing.ts + settings
  const shipping = goodsTotal >= 50 ? 0 : 4.9;
  const amount = Math.round((goodsTotal + shipping) * 100); // cents, VAT already included
  return { amount, discount, couponReason: reason };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { items, couponCode } = await req.json();
    if (!Array.isArray(items) || items.length === 0) return json({ error: "No items" }, 400);

    const { amount, discount, couponReason } = await computeTotal(items, couponCode);
    if (amount <= 0) return json({ error: "Invalid amount" }, 400);

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
    });
    return json({ clientSecret: intent.client_secret, amount, discount, couponReason });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
