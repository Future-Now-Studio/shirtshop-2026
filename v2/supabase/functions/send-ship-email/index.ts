// Sends a "your order shipped" email to the customer via Resend. Called by the
// admin when marking an order shipped. Needs RESEND_API_KEY (+ optional
// ORDER_EMAIL_FROM). Best effort — returns ok even if email is not configured.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);
    const { orderId } = await req.json();
    if (!orderId) return json({ error: "Missing orderId" }, 400);

    const { data: order, error } = await supabase
      .from("orders").select("id, customer_name, customer_email, tracking_number, total").eq("id", orderId).single();
    if (error) throw error;
    if (!order.customer_email) return json({ ok: true, skipped: "no customer email" });

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ ok: true, skipped: "no RESEND_API_KEY" });

    const html = `
      <h2>Deine Bestellung ist unterwegs! 📦</h2>
      <p>Hallo ${esc(order.customer_name)},</p>
      <p>gute Neuigkeiten — deine Bestellung wurde soeben versendet.</p>
      ${order.tracking_number ? `<p><b>Sendungsnummer:</b> ${esc(order.tracking_number)}</p>` : ""}
      <p>Bestell-ID: ${esc(order.id)}</p>
      <p>Danke für deinen Einkauf bei Private Shirt!</p>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("ORDER_EMAIL_FROM") || "Private Shirt <onboarding@resend.dev>",
        to: [order.customer_email],
        subject: "Deine Private-Shirt-Bestellung wurde versendet",
        html,
      }),
    });
    if (!r.ok) return json({ ok: false, error: await r.text() });
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
