// Marks a paid order as shipped (status, tracking number, shipped_at) and
// mails the customer — once: repeating the mail needs resend:true. With
// attachInvoice the invoice PDF is attached (issued now if needed, so it
// carries the exact delivery date). Admin-triggered. Mail is best effort and
// skipped when RESEND_API_KEY is missing.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { isUuid, requireAdmin } from "../_shared/admin.ts";
import { esc, sendEmail } from "../_shared/email.ts";
import { ensureInvoice, toBase64 } from "../_shared/invoice.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const SHIPPABLE = ["paid", "in_production", "shipped"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);
    const body = await req.json();
    const { orderId } = body;
    if (!isUuid(orderId)) return json({ error: "Missing orderId" }, 400);

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_number, status, customer_name, customer_email, tracking_number, shipped_at, ship_email_sent_at")
      .eq("id", orderId).maybeSingle();
    if (error) throw error;
    if (!order) return json({ error: "Bestellung nicht gefunden." }, 404);
    if (!SHIPPABLE.includes(order.status)) {
      return json({ error: "Nur bezahlte Bestellungen können als versendet markiert werden." }, 400);
    }

    const tracking = body.trackingNumber === undefined
      ? order.tracking_number
      : String(body.trackingNumber ?? "").trim().slice(0, 100) || null;
    const shippedAt = order.shipped_at ?? new Date().toISOString();
    const { error: upErr } = await supabase
      .from("orders").update({ status: "shipped", tracking_number: tracking, shipped_at: shippedAt }).eq("id", order.id);
    if (upErr) throw upErr;

    if (order.ship_email_sent_at && body.resend !== true) {
      return json({ ok: true, mailed: false, alreadySent: order.ship_email_sent_at });
    }
    if (!order.customer_email) return json({ ok: true, mailed: false, skipped: "no customer email" });

    let attachments: { filename: string; content: string }[] | undefined;
    let invoiceNumber: string | null = null;
    let invoiceError: string | null = null;
    if (body.attachInvoice === true) {
      try {
        const inv = await ensureInvoice(supabase, order.id);
        invoiceNumber = inv.number;
        attachments = [{ filename: `Rechnung-${inv.number}.pdf`, content: toBase64(inv.pdf) }];
      } catch (e) {
        console.error(e);
        invoiceError = (e as Error).message;
      }
    }

    const orderNo = order.order_number ?? order.id.slice(0, 8);
    const html = `
      <h2>Deine Bestellung ist unterwegs! 📦</h2>
      <p>Hallo ${esc(order.customer_name)},</p>
      <p>gute Neuigkeiten — deine Bestellung ${esc(orderNo)} wurde soeben versendet.</p>
      ${tracking ? `<p><b>Sendungsnummer:</b> ${esc(tracking)}</p>` : ""}
      ${invoiceNumber ? `<p>Deine Rechnung ${esc(invoiceNumber)} findest du im Anhang.</p>` : ""}
      <p>Danke für deinen Einkauf bei Private Shirt!</p>`;
    const mailed = await sendEmail(order.customer_email, `Deine Bestellung ${orderNo} wurde versendet`, html, attachments);
    if (mailed) {
      await supabase.from("orders").update({ ship_email_sent_at: new Date().toISOString() }).eq("id", order.id);
      if (invoiceNumber) {
        await supabase.from("invoices").update({ emailed_at: new Date().toISOString() }).eq("order_id", order.id);
      }
    }
    return json({
      ok: true,
      mailed,
      skipped: mailed ? undefined : Deno.env.get("RESEND_API_KEY") ? "rejected" : "not configured",
      invoiceNumber,
      invoiceError,
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Versand konnte nicht gespeichert werden." }, 500);
  }
});
