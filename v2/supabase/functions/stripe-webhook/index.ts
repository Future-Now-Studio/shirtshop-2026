// Stripe webhook safety net. Verifies the signature; on a succeeded payment
// that has no matching order (e.g. the browser closed before create-order ran),
// it alerts the shop owner by email so the payment can be reconciled manually.
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function alert(subject: string, text: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return;
  const { data: s } = await supabase.from("settings").select("order_email").eq("id", 1).single();
  const to = Deno.env.get("ORDER_EMAIL_TO") || s?.order_email;
  if (!to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("ORDER_EMAIL_FROM") || "Private Shirt <onboarding@resend.dev>",
      to: [to],
      subject,
      html: `<p>${text}</p>`,
    }),
  });
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
    return new Response(`Webhook Error: ${(e as Error).message}`, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("stripe_payment_intent_id", pi.id)
      .maybeSingle();
    if (!order) {
      await alert(
        "⚠️ Zahlung ohne Bestellung",
        `Eine Stripe-Zahlung war erfolgreich, aber es gibt keine passende Bestellung. PaymentIntent: ${pi.id}, Betrag: ${(pi.amount / 100).toFixed(2)} ${pi.currency}. Bitte manuell prüfen.`,
      );
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
