// Persists an order after Stripe payment succeeds. Called by the browser right
// after payment; stripe-webhook does the same if the browser never returns.
// The order is built only from the server-side cart snapshot (checkout_carts)
// and the paid amount — never from client-sent prices or items.
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { errorResponse, HttpError } from "../_shared/cart.ts";
import { placeOrderForIntent } from "../_shared/order.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const paymentIntentId = body?.paymentIntentId;
    if (typeof paymentIntentId !== "string" || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
      throw new HttpError(400, "Ungültige Zahlung.");
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const placed = await placeOrderForIntent(supabase, intent);
    if (!placed) throw new HttpError(409, "Zur Zahlung wurde kein Warenkorb gefunden. Bitte kontaktiere uns.");
    return json(placed);
  } catch (e) {
    const { body, status } = errorResponse(e);
    return json(body, status);
  }
});
