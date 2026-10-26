// DSGVO Art. 17: removes a customer's personal data from an order — name,
// e-mail, address, tracking number, internal note and the uploaded design
// files — while amounts, order lines and issued invoice documents stay (they
// must be retained for tax purposes, Art. 17 Abs. 3 lit. b DSGVO). Admin-
// triggered; orders being fulfilled ('paid', 'in_production') cannot be
// anonymised — same rule as anonymize_order() in SQL.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { isUuid, requireAdmin } from "../_shared/admin.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function removeFolder(bucket: string, folder: string): Promise<number> {
  let removed = 0;
  for (let round = 0; round < 20; round++) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
    if (error) throw error;
    const paths = (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
    if (paths.length === 0) return removed;
    const { error: rmErr } = await supabase.storage.from(bucket).remove(paths);
    if (rmErr) throw rmErr;
    removed += paths.length;
  }
  throw new Error(`could not empty ${bucket}/${folder}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);
    const { orderId } = await req.json();
    if (!isUuid(orderId)) return json({ error: "Missing orderId" }, 400);

    const { data: order, error } = await supabase
      .from("orders").select("id, status, anonymized_at, order_items(design_data, design_render_paths)")
      .eq("id", orderId).maybeSingle();
    if (error) throw error;
    if (!order) return json({ error: "Bestellung nicht gefunden." }, 404);
    if (order.anonymized_at) return json({ ok: true, already: true });
    if (["paid", "in_production"].includes(order.status)) {
      return json({ error: "Die Bestellung wird gerade bearbeitet (bezahlt oder in Produktion) und kann erst anonymisiert werden, wenn sie versendet, abgeschlossen oder erstattet ist." }, 400);
    }

    // Design files first: afterwards the design ids are gone from the order.
    let filesRemoved = 0;
    const designIds = new Set<string>();
    for (const it of order.order_items ?? []) {
      const id = (it.design_data as any)?.designId;
      if (isUuid(id)) designIds.add(id);
      const renders = (it.design_render_paths ?? []).filter(Boolean);
      if (renders.length) {
        const { error: rmErr } = await supabase.storage.from("design-renders").remove(renders);
        if (rmErr) throw rmErr;
        filesRemoved += renders.length;
      }
    }
    for (const designId of designIds) {
      // The same design can belong to another order (re-used cart) — keep it then.
      const { data: other } = await supabase
        .from("order_items").select("order_id").eq("design_data->>designId", designId).neq("order_id", order.id).limit(1);
      if (other?.length) continue;
      filesRemoved += await removeFolder("order-designs", designId);
    }

    const { error: anonErr } = await supabase.rpc("anonymize_order", { p_order_id: order.id });
    if (anonErr) throw anonErr;
    return json({ ok: true, filesRemoved });
  } catch (e) {
    console.error(e);
    return json({ error: "Anonymisierung fehlgeschlagen." }, 500);
  }
});
