// Persists an order after Stripe payment succeeds. Called by the browser right
// after payment; stripe-webhook does the same if the browser never returns.
// The order is built only from the server-side cart snapshot (checkout_carts)
// and the paid amount — never from client-sent prices or items.
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { errorResponse, HttpError } from "../_shared/cart.ts";
import { alertOrderFailure, placeOrderForIntent } from "../_shared/order.ts";

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
    throw new HttpError(503, "Die Bestellung kann gerade nicht angelegt werden. Deine Zahlung ist sicher – bitte versuche es gleich noch einmal.");
  }
  return (stripeClient ??= new Stripe(key, {
    apiVersion: "2024-12-18.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let intent: any = null;
  try {
    const body = await req.json().catch(() => null);
    const paymentIntentId = body?.paymentIntentId;
    if (typeof paymentIntentId !== "string" || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
      throw new HttpError(400, "Ungültige Zahlung.");
    }

    intent = await stripe().paymentIntents.retrieve(paymentIntentId);
    const placed = await placeOrderForIntent(supabase, intent);
    if (!placed) throw new HttpError(409, "Zur Zahlung wurde kein Warenkorb gefunden. Bitte kontaktiere uns.");
    return json(placed);
  } catch (e) {
    // A paid order that cannot be created must reach the owner (once).
    await alertOrderFailure(supabase, intent, e);
    const { body, status } = errorResponse(e);
    return json(body, status);
  }
});
