// Creates a Stripe PaymentIntent for the server-computed total. The intent's
// metadata pins the priced cart (hash) and coupon; the cart, its frozen unit
// prices and the customer are stored in checkout_carts (save_checkout_cart,
// which also reserves the coupon use) so create-order / stripe-webhook can
// build the order from server-side data only.
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  cartHash, computeTotal, errorResponse, HttpError, parseCustomer, parseItems, sha256Hex, verifyDesigns, type CartLine,
} from "../_shared/cart.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Created on first use, so a missing key answers with a JSON error instead
// of crashing the whole function at boot.
let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set");
    throw new HttpError(503, "Die Online-Zahlung ist gerade nicht verfügbar. Bitte versuche es später erneut.");
  }
  return (stripeClient ??= new Stripe(key, {
    apiVersion: "2024-12-18.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  }));
}

const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;

// Live stock check before payment — rejects lines exceeding available stock so
// nobody can pay for pieces we cannot fulfil. place_order re-checks under a
// row lock and flags the order if stock ran out in the meantime.
async function assertStock(items: CartLine[]) {
  const withSize = items.filter((i) => i.sizeId);
  if (!withSize.length) return;
  const { data, error } = await supabase
    .from("variant_size_availability")
    .select("variant_id, size_id, stock, available, sizes(name)")
    .in("variant_id", [...new Set(withSize.map((i) => i.variantId))]);
  if (error) throw error;
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

async function cancelIntent(id: string) {
  try {
    await stripe().paymentIntents.cancel(id);
  } catch (e) {
    console.warn(`cancel ${id} failed:`, (e as any)?.message ?? e);
  }
}

// "Angaben ändern" in the checkout replaces the previous attempt: release its
// coupon reservation and cancel its intent. The client secret proves that the
// caller owns that attempt.
async function releaseAttempt(clientSecret: string) {
  const id = /^(pi_[A-Za-z0-9]+)_secret_[A-Za-z0-9]+$/.exec(clientSecret)?.[1];
  if (!id) return;
  const { data, error } = await supabase
    .from("checkout_carts").update({ released_at: new Date().toISOString() })
    .eq("payment_intent_id", id).eq("secret_hash", await sha256Hex(clientSecret)).is("released_at", null)
    .select("payment_intent_id");
  if (error) throw error;
  if (data?.length) await cancelIntent(id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => null);
    const lines = parseItems(body?.items);
    const customer = parseCustomer(body?.customer);
    const couponCode = typeof body?.couponCode === "string" ? body.couponCode.slice(0, 64) : undefined;

    // Throttle before any expensive work (Stripe, design downloads).
    const { data: limited, error: limitErr } = await supabase.rpc("checkout_rate_limit", {
      p_email: customer.email,
      p_ip: clientIp(req),
    });
    if (limitErr) throw limitErr;
    if (limited) throw new HttpError(429, String(limited));

    if (typeof body?.replaceClientSecret === "string") await releaseAttempt(body.replaceClientSecret.slice(0, 200));

    const total = await computeTotal(supabase, lines, couponCode);
    await assertStock(lines);
    await verifyDesigns(supabase, lines);
    // Stripe's minimum charge is 0,50 €.
    if (total.amount < 50) throw new HttpError(400, "Der Bestellwert ist zu niedrig für eine Online-Zahlung.");

    const intent = await stripe().paymentIntents.create({
      amount: total.amount,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: {
        cart_hash: await cartHash(lines),
        coupon_id: total.coupon?.id ?? "",
        coupon_code: total.coupon?.code ?? "",
        discount: total.discount.toFixed(2),
        volume_discount: total.volumeDiscount.toFixed(2),
        shipping: total.shipping.toFixed(2),
      },
    });

    const { data: saved, error: saveErr } = await supabase.rpc("save_checkout_cart", {
      p_payment_intent_id: intent.id,
      p_items: lines,
      p_prices: total.priced.map(({ unit, name }) => ({ unit, name })),
      p_customer: customer,
      p_coupon_id: total.coupon?.id ?? null,
      p_secret_hash: await sha256Hex(intent.client_secret!),
    });
    if (saveErr || !saved) {
      await cancelIntent(intent.id);
      if (saveErr) throw saveErr;
      // Another checkout took the last use of the coupon a moment ago.
      throw new HttpError(409, "Der Gutschein ist inzwischen ausgeschöpft (Limit erreicht). Bitte entferne ihn und versuche es erneut.");
    }

    return json({
      clientSecret: intent.client_secret,
      amount: total.amount,
      subtotal: total.subtotal,
      volumeDiscount: total.volumeDiscount,
      discount: total.discount,
      shipping: total.shipping,
      couponCode: total.coupon?.code ?? null,
      couponReason: total.couponReason,
    });
  } catch (e) {
    const { body, status } = errorResponse(e);
    return json(body, status);
  }
});
