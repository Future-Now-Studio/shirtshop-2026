// Stripe webhook safety net. Verifies the signature; on a succeeded payment it
// creates the order from the stored cart if create-order has not (e.g. the
// browser closed right after paying). If no cart exists, or the order cannot
// be created, the shop owner is alerted to reconcile the payment manually.
// charge.refunded records refunds made outside the shop (Stripe Dashboard) —
// refunds from Admin → Bestellung are already recorded and deduplicated by
// their Stripe refund id. charge.dispute.created flags the order for review
// ("Prüfen nötig") and alerts the owner.
// Non-2xx makes Stripe retry.
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendOwnerAlert } from "../_shared/email.ts";
import { alertOrderFailure, placeOrderForIntent } from "../_shared/order.ts";
import { ensureCreditNote } from "../_shared/invoice.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

// Created on first use, so a missing key answers with an error (and Stripe
// retries) instead of crashing the whole function at boot.
let stripeClient: Stripe | null = null;
function stripe(): Stripe | null {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return null;
  return (stripeClient ??= new Stripe(key, {
    apiVersion: "2024-12-18.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  }));
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const client = stripe();
  if (!client) {
    console.error("STRIPE_SECRET_KEY is not set");
    return jsonResponse({ error: "Stripe nicht konfiguriert" }, 500);
  }
  const sig = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body = await req.text();
  let event: any;
  try {
    if (!sig || !secret) throw new Error("missing signature/secret");
    event = await client.webhooks.constructEventAsync(body, sig, secret, undefined, cryptoProvider);
  } catch (e) {
    if (!secret) console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    try {
      const placed = await placeOrderForIntent(supabase, pi);
      if (!placed) {
        await sendOwnerAlert(
          supabase,
          "⚠️ Zahlung ohne Bestellung",
          `Eine Stripe-Zahlung war erfolgreich, aber es gibt keinen gespeicherten Warenkorb. PaymentIntent: ${pi.id}, Betrag: ${(pi.amount / 100).toFixed(2)} ${pi.currency}. Bitte manuell prüfen.`,
        );
      }
    } catch (e) {
      console.error(e);
      await alertOrderFailure(supabase, pi, e);
      return new Response("order placement failed", { status: 500 });
    }
  }

  if (event.type === "charge.refunded") {
    try {
      await recordStripeRefunds(client, event.data.object);
    } catch (e) {
      console.error(e);
      return new Response("refund recording failed", { status: 500 });
    }
  }

  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object;
    const order = await orderForIntent(dispute.payment_intent);
    const flag = order ? await flagChargeback(order.id, dispute) : null;
    await sendOwnerAlert(
      supabase,
      "⚠️ Zahlung angefochten (Chargeback)",
      `Eine Zahlung wurde angefochten: ${(dispute.amount / 100).toFixed(2)} ${dispute.currency}, Grund: ${disputeReason(dispute.reason)}.` +
        `\nBestellung: ${order ? `#${order.order_number} (${order.status})` : `unbekannt (PaymentIntent ${dispute.payment_intent})`}` +
        (flag === "error" ? "\nDer Prüfhinweis konnte nicht an der Bestellung gesetzt werden – bitte selbst vermerken." : flag ? "\nDie Bestellung ist unter Admin → Bestellungen als „Prüfen nötig“ markiert." : "") +
        "\nBitte im Stripe-Dashboard Beweise einreichen und die Bestellung ggf. anhalten.",
    );
  }

  return jsonResponse({ received: true });
});

async function orderForIntent(paymentIntentId: unknown) {
  if (typeof paymentIntentId !== "string") return null;
  const { data, error } = await supabase
    .from("orders").select("id, order_number, status").eq("stripe_payment_intent_id", paymentIntentId).maybeSingle();
  if (error) throw error;
  return data;
}

// Stripe dispute reasons in German (https://docs.stripe.com/api/disputes/object#dispute_object-reason).
const DISPUTE_REASONS: Record<string, string> = {
  fraudulent: "Betrug / nicht autorisiert",
  product_not_received: "Ware nicht erhalten",
  product_unacceptable: "Ware mangelhaft oder nicht wie beschrieben",
  duplicate: "doppelt belastet",
  credit_not_processed: "Erstattung nicht erhalten",
  subscription_canceled: "Abo gekündigt",
  unrecognized: "Zahlung nicht erkannt",
  general: "allgemein",
};
const disputeReason = (r: unknown) => DISPUTE_REASONS[String(r)] ?? String(r ?? "unbekannt");

// Marks the order for review. flag_order_review appends to an existing reason
// (stock, coupon …) instead of replacing it and ignores a repeated delivery of
// the same dispute (the text is deterministic). A failure must not block the
// alert mail, so it is reported there instead of making Stripe retry.
async function flagChargeback(orderId: string, dispute: any): Promise<"flagged" | "already" | "error"> {
  const amount = `${(dispute.amount / 100).toFixed(2).replace(".", ",")} ${String(dispute.currency ?? "").toUpperCase()}`;
  const due = dispute.evidence_details?.due_by
    ? `, Antwortfrist ${new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`
    : "";
  const reason = `Zahlung angefochten (Chargeback): ${amount}, Grund: ${disputeReason(dispute.reason)}${due} (Stripe ${dispute.id})`;
  const { data, error } = await supabase.rpc("flag_order_review", { p_order_id: orderId, p_reason: reason });
  if (error) {
    console.error("flag_order_review", orderId, error);
    return "error";
  }
  return data ? "flagged" : "already";
}

// Records every succeeded refund of the charge once (record_order_refund
// deduplicates by Stripe refund id) and marks the order refunded once the
// charge is fully refunded. Correction invoices are best effort, as in refund-order.
async function recordStripeRefunds(client: Stripe, charge: any) {
  const order = await orderForIntent(charge.payment_intent);
  if (!order) {
    console.warn("charge.refunded without order", charge.payment_intent);
    return;
  }
  const refunds = await client.refunds.list({ charge: charge.id, limit: 100 });
  let created = 0;
  for (const r of refunds.data) {
    if (r.status !== "succeeded") continue;
    const { data: rec, error } = await supabase.rpc("record_order_refund", {
      p_refund_id: crypto.randomUUID(),
      p_order_id: order.id,
      p_amount: r.amount / 100,
      p_full: false,
      p_reason: "Erstattung über Stripe",
      p_stripe_refund_id: r.id,
      p_actor: null,
    });
    if (error) throw error;
    if (rec?.created) {
      created++;
      await ensureCreditNote(supabase, rec.refund_id).catch((e) => console.error("credit note", rec.refund_id, e));
    }
  }
  if (charge.refunded) {
    const { error } = await supabase.rpc("mark_order_refunded", { p_order_id: order.id });
    if (error) throw error;
  }
  if (created > 0) {
    await sendOwnerAlert(
      supabase,
      `Erstattung zu Bestellung #${order.order_number} erfasst`,
      `In Stripe wurde eine Erstattung ausgeführt (${(charge.amount_refunded / 100).toFixed(2)} ${charge.currency} insgesamt erstattet).` +
        "\nSie ist jetzt in der Bestellung vermerkt; die Rechnungskorrektur liegt unter Admin → Bestellung.",
    );
  }
}
