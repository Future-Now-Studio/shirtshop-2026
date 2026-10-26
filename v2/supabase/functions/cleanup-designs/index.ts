// Deletes design uploads nobody ordered: folders in the order-designs bucket
// whose last upload is older than `days` and that no order, no recent
// checkout and no bulk inquiry references (public.orphan_design_files).
// Files are removed through the Storage API — direct SQL deletes on
// storage.objects are blocked and would leave the files behind.
//   POST { dryRun?: boolean (default true), days?: number (default 30, min 7) }
// Callable with the service-role key (scheduled job) or by an admin.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BUCKET = "order-designs";
const DEFAULT_DAYS = 30; // carts live in the browser; keep their designs a while
const MIN_DAYS = 7;
const MAX_FILES = 5000; // per run; the next run continues
const BATCH = 100;

function isServiceRole(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return key.length > 0 && token === key;
}

const folderOf = (name: string) => (name.startsWith("bulk/") ? name.split("/", 2).join("/") : name.split("/", 1)[0]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!isServiceRole(req) && !(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false;
    const requested = Number(body?.days ?? DEFAULT_DAYS);
    const days = Number.isFinite(requested) ? Math.min(365, Math.max(MIN_DAYS, Math.floor(requested))) : DEFAULT_DAYS;

    const { data, error } = await supabase.rpc("orphan_design_files", { p_older_than: `${days} days`, p_limit: MAX_FILES });
    if (error) throw error;
    const files = (data ?? []) as { name: string; size: number | null }[];
    const names = files.map((f) => f.name);
    const folders = [...new Set(names.map(folderOf))];
    const bytes = files.reduce((s, f) => s + Number(f.size ?? 0), 0);
    const summary = { days, folders: folders.length, files: names.length, bytes, more: names.length === MAX_FILES };

    if (dryRun) return json({ ok: true, dryRun: true, ...summary, sample: folders.slice(0, 20) });

    let deleted = 0;
    let failed = 0;
    for (let i = 0; i < names.length; i += BATCH) {
      const chunk = names.slice(i, i + BATCH);
      const { data: removed, error: rmErr } = await supabase.storage.from(BUCKET).remove(chunk);
      if (rmErr) {
        console.error("cleanup-designs remove", rmErr);
        failed += chunk.length;
      } else {
        deleted += removed?.length ?? 0;
      }
    }

    // The upload budget only looks at the current 10-minute window.
    const { error: winErr } = await supabase
      .from("design_upload_windows").delete().lt("window_start", new Date(Date.now() - 2 * 86400_000).toISOString());
    if (winErr) console.error("cleanup-designs windows", winErr);

    console.log(`cleanup-designs: deleted ${deleted} files in ${folders.length} folders (${failed} failed)`);
    return json({ ok: true, dryRun: false, ...summary, deleted, failed });
  } catch (e) {
    console.error(e);
    return json({ error: "Aufräumen fehlgeschlagen." }, 500);
  }
});
