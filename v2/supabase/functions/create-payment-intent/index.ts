// Creates a Stripe PaymentIntent for the server-computed total. The intent's
// metadata pins the priced cart (hash) and coupon; the cart + customer are
// stored in checkout_carts so create-order / stripe-webhook can build the order
// from server-side data only.
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { cartHash, computeTotal, errorResponse, HttpError, parseCustomer, parseItems, type CartLine } from "../_shared/cart.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Live stock check before payment — rejects lines exceeding available stock so
// nobody can pay for pieces we cannot fulfil.
async function assertStock(items: CartLine[]) {
  const withSize = items.filter((i) => i.sizeId);
  if (!withSize.length) return;
  const { data } = await supabase
    .from("variant_size_availability")
    .select("variant_id, size_id, stock, available, sizes(name)")
    .in("variant_id", [...new Set(withSize.map((i) => i.variantId))]);
  // aggregate requested qty per variant+size (multiple lines may share one)
  const wanted = new Map<string, number>();
  for (const i of withSize) {
    const k = `${i.variantId}:${i.sizeId}`;
    wanted.set(k, (wanted.get(k) ?? 0) + i.qty);
  }
  for (const [k, qty] of wanted) {
    const [variantId, sizeId] = k.split(":");
    const row = (data ?? []).find((r) => r.variant_id === variantId && r.size_id === sizeId);
    const stock = row && row.available ? (row.stock ?? 0) : 0;
    if (qty > stock) {
      const sizeName = (row as any)?.sizes?.name ?? "";
      throw new HttpError(409, `Nicht genug Bestand${sizeName ? ` (Größe ${sizeName})` : ""}: nur noch ${stock} verfügbar.`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const lines = parseItems(body?.items);
    const customer = parseCustomer(body?.customer);
    const couponCode = typeof body?.couponCode === "string" ? body.couponCode.slice(0, 64) : undefined;

    await assertStock(lines);
    const { amount, discount, volumeDiscount, shipping, coupon, couponReason } = await computeTotal(supabase, lines, couponCode);
    if (amount <= 0) return json({ error: "Ungültiger Betrag." }, 400);

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: {
        cart_hash: await cartHash(lines),
        coupon_id: coupon?.id ?? "",
        coupon_code: coupon?.code ?? "",
        discount: discount.toFixed(2),
        volume_discount: volumeDiscount.toFixed(2),
        shipping: shipping.toFixed(2),
      },
    });
    const { error: cartErr } = await supabase
      .from("checkout_carts")
      .insert({ payment_intent_id: intent.id, items: lines, customer });
    if (cartErr) throw cartErr;

    return json({ clientSecret: intent.client_secret, amount, discount, couponReason });
  } catch (e) {
    const { body, status } = errorResponse(e);
    return json(body, status);
  }
});
