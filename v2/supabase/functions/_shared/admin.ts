// Guard for admin-only edge functions. Edge functions are callable by anyone
// holding the public anon key, so admin actions (refund, invoice, ship mail)
// must verify the caller's JWT belongs to a user listed in public.admins. A
// merely signed-up user is not enough.
import { createClient } from "jsr:@supabase/supabase-js@2";

const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

/** The calling admin's user id, or null when the caller is not an admin. */
export async function adminUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: row } = await service.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return row ? data.user.id : null;
}

export async function requireAdmin(req: Request): Promise<boolean> {
  return (await adminUserId(req)) !== null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
