// Stripe webhook safety net. Verifies the signature; on a succeeded payment it
// creates the order from the stored cart if create-order has not (e.g. the
// browser closed right after paying). Only if no cart exists is the shop owner
// alerted to reconcile the payment manually. Non-2xx makes Stripe retry.
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { esc, sendEmail } from "../_shared/email.ts";
import { placeOrderForIntent } from "../_shared/order.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function alert(subject: string, text: string) {
  const { data: s } = await supabase.from("settings").select("order_email").eq("id", 1).maybeSingle();
  await sendEmail(Deno.env.get("ORDER_EMAIL_TO") || s?.order_email, subject, `<p>${esc(text)}</p>`);
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body = await req.text();
  let event: any;
  try {
    if (!sig || !secret) throw new Error("missing signature/secret");
    event = await stripe.webhooks.constructEventAsync(body, sig, secret, undefined, cryptoProvider);
  } catch (e) {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    try {
      const placed = await placeOrderForIntent(supabase, pi);
      if (!placed) {
        await alert(
          "⚠️ Zahlung ohne Bestellung",
          `Eine Stripe-Zahlung war erfolgreich, aber es gibt keinen gespeicherten Warenkorb. PaymentIntent: ${pi.id}, Betrag: ${(pi.amount / 100).toFixed(2)} ${pi.currency}. Bitte manuell prüfen.`,
        );
      }
    } catch (e) {
      console.error(e);
      return new Response("order placement failed", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
