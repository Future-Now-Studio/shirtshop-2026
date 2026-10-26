// Returns an order's invoice PDF as base64 — or, with refundId, the
// correction invoice (Storno/Rechnungskorrektur) for that refund. Admin-
// triggered. Numbers are issued once and gap-free; the first rendering is
// stored in the private "invoices" bucket and returned unchanged afterwards.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { isUuid, requireAdmin } from "../_shared/admin.ts";
import { DocError, ensureCreditNote, ensureInvoice, toBase64 } from "../_shared/invoice.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);
    const { orderId, refundId } = await req.json();
    if (!isUuid(orderId)) return json({ error: "Missing orderId" }, 400);

    if (refundId != null) {
      if (!isUuid(refundId)) return json({ error: "Ungültige Erstattung." }, 400);
      const { data: refund } = await supabase.from("order_refunds").select("order_id").eq("id", refundId).maybeSingle();
      if (refund?.order_id !== orderId) return json({ error: "Erstattung gehört nicht zu dieser Bestellung." }, 400);
      const doc = await ensureCreditNote(supabase, refundId);
      return json({ pdfBase64: toBase64(doc.pdf), number: doc.number, filename: `${doc.number}.pdf` });
    }

    const doc = await ensureInvoice(supabase, orderId);
    return json({ pdfBase64: toBase64(doc.pdf), number: doc.number, filename: `Rechnung-${doc.number}.pdf` });
  } catch (e) {
    if (e instanceof DocError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Rechnung konnte nicht erstellt werden." }, 500);
  }
});
