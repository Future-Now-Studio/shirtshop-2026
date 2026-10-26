// Refunds an order via Stripe — in full or partially (amount) — records the
// refund and issues its correction invoice (Stornorechnung for full refunds,
// Rechnungskorrektur for partial ones). A full refund also restores stock and
// sets status=refunded (mark_order_refunded); a partial one changes neither.
// Admin-triggered. Requires STRIPE_SECRET_KEY.
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { adminUserId, isUuid } from "../_shared/admin.ts";
import { ensureCreditNote } from "../_shared/invoice.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const REFUNDABLE = ["paid", "in_production", "shipped", "completed"];
const round2 = (n: number) => Math.round(n * 100) / 100;
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const adminId = await adminUserId(req);
    if (!adminId) return json({ error: "Unauthorized" }, 401);
    const body = await req.json();
    const { orderId } = body;
    if (!isUuid(orderId)) return json({ error: "Missing orderId" }, 400);

    // Built per request: a missing key must give a readable answer instead of
    // crashing the worker at boot.
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return json({ error: "Stripe ist nicht eingerichtet (STRIPE_SECRET_KEY fehlt) – Erstattung nicht möglich." }, 503);
    }

    const { data: order, error } = await supabase
      .from("orders").select("id, status, total, refunded_amount, stripe_payment_intent_id").eq("id", orderId).maybeSingle();
    if (error) throw error;
    if (!order) return json({ error: "Bestellung nicht gefunden." }, 404);
    if (order.status === "refunded") return json({ error: "Diese Bestellung ist bereits vollständig erstattet." }, 400);
    if (!REFUNDABLE.includes(order.status)) return json({ error: "Nur bezahlte Bestellungen können erstattet werden." }, 400);
    if (!order.stripe_payment_intent_id) {
      return json({ error: "Zu dieser Bestellung gibt es keine Online-Zahlung – bitte manuell erstatten." }, 400);
    }

    const remaining = round2(Number(order.total ?? 0) - Number(order.refunded_amount ?? 0));
    let amount: number | null = null;
    if (body.amount != null) {
      amount = round2(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Ungültiger Betrag." }, 400);
      if (amount > remaining) return json({ error: `Es können höchstens ${eur(remaining)} erstattet werden.` }, 400);
    }
    const full = amount === null || amount === remaining;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
    if (!full && reason.length < 3) {
      return json({ error: "Bitte einen Grund für die Teilerstattung angeben (steht auf der Rechnungskorrektur)." }, 400);
    }
    // The UI sends one request id per refund dialog: retries and double
    // clicks reuse it, so Stripe and record_order_refund act only once.
    const refundId = isUuid(body.requestId) ? body.requestId : crypto.randomUUID();

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-12-18.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });
    let refunded = full ? remaining : amount!;
    let stripeRefundId: string | null = null;
    try {
      const r = await stripe.refunds.create(
        full
          ? { payment_intent: order.stripe_payment_intent_id }
          : { payment_intent: order.stripe_payment_intent_id, amount: Math.round(amount! * 100) },
        // One key per refund request (double clicks share it). Not per order:
        // Stripe caches failed responses for 24h, so a full refund that failed
        // (e.g. insufficient balance) could not be retried. A second full
        // refund gets charge_already_refunded, which still means the money is back.
        { idempotencyKey: `refund-${refundId}` },
      );
      stripeRefundId = r.id;
      refunded = r.amount / 100;
    } catch (e) {
      const err = e as any;
      if (!(full && err?.code === "charge_already_refunded")) {
        console.error(e);
        const msg = err?.type?.startsWith?.("Stripe") && err?.message ? `: ${err.message}` : "";
        return json({ error: `Stripe hat die Erstattung abgelehnt${msg}` }, 502);
      }
    }

    // Refund row, refunded_amount and — for full refunds — status + stock
    // (mark_order_refunded) in one transaction.
    let recordedId = refundId;
    if (refunded > 0) {
      const { data: rec, error: recErr } = await supabase.rpc("record_order_refund", {
        p_refund_id: refundId,
        p_order_id: order.id,
        p_amount: refunded,
        p_full: full,
        p_reason: reason || null,
        p_stripe_refund_id: stripeRefundId,
        p_actor: adminId,
      });
      if (recErr) {
        console.error("refund executed at Stripe but not recorded", order.id, stripeRefundId, recErr);
        return json({ error: "Die Erstattung wurde bei Stripe ausgeführt, aber nicht gespeichert. Bitte erneut auf „Erstatten“ klicken." }, 500);
      }
      recordedId = rec.refund_id;
    } else {
      const { error: markErr } = await supabase.rpc("mark_order_refunded", { p_order_id: order.id });
      if (markErr) throw markErr;
      return json({ ok: true, refunded: 0, full });
    }

    // Correction invoice: best effort — the refund itself already stands, and
    // the document can be created again from the order page.
    let creditNote: string | null = null;
    let documentError: string | null = null;
    try {
      creditNote = (await ensureCreditNote(supabase, recordedId)).number;
    } catch (e) {
      console.error(e);
      documentError = "Die Rechnungskorrektur konnte nicht erstellt werden – bitte über „PDF“ bei der Erstattung erneut versuchen.";
    }
    return json({ ok: true, refunded, full, refundId: recordedId, creditNote, documentError });
  } catch (e) {
    console.error(e);
    return json({ error: "Erstattung fehlgeschlagen." }, 500);
  }
});
