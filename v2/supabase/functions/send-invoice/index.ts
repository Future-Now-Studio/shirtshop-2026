// Mails the order's invoice PDF to the customer (issued and stored first if
// needed). Admin-triggered. Needs RESEND_API_KEY.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { isUuid, requireAdmin } from "../_shared/admin.ts";
import { esc, sendEmail } from "../_shared/email.ts";
import { DocError, ensureInvoice, toBase64 } from "../_shared/invoice.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);
    const { orderId } = await req.json();
    if (!isUuid(orderId)) return json({ error: "Missing orderId" }, 400);

    const { data: order, error } = await supabase
      .from("orders").select("id, order_number, customer_name, customer_email").eq("id", orderId).maybeSingle();
    if (error) throw error;
    if (!order) return json({ error: "Bestellung nicht gefunden." }, 404);
    if (!order.customer_email) return json({ error: "Zu dieser Bestellung ist keine Kunden-E-Mail hinterlegt." }, 400);

    const inv = await ensureInvoice(supabase, order.id);
    if (!Deno.env.get("RESEND_API_KEY")) {
      return json({ error: `Rechnung ${inv.number} ist erstellt, aber der E-Mail-Versand ist nicht eingerichtet (RESEND_API_KEY fehlt).` }, 503);
    }
    const orderNo = order.order_number ?? order.id.slice(0, 8);
    const sent = await sendEmail(
      order.customer_email,
      `Deine Rechnung ${inv.number} von Private Shirt`,
      `<p>Hallo ${esc(order.customer_name)},</p>
       <p>anbei erhältst du die Rechnung ${esc(inv.number)} zu deiner Bestellung ${esc(orderNo)}.</p>
       <p>Viele Grüße<br>dein Private-Shirt-Team</p>`,
      [{ filename: `Rechnung-${inv.number}.pdf`, content: toBase64(inv.pdf) }],
    );
    if (!sent) return json({ error: "Der E-Mail-Dienst hat die Mail abgelehnt. Bitte später erneut versuchen." }, 502);

    const emailedAt = new Date().toISOString();
    await supabase.from("invoices").update({ emailed_at: emailedAt }).eq("order_id", order.id);
    return json({ ok: true, invoiceNumber: inv.number, emailedAt });
  } catch (e) {
    if (e instanceof DocError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Rechnung konnte nicht gesendet werden." }, 500);
  }
});
