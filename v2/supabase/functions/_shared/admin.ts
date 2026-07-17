// Guard for admin-only edge functions. Edge functions are callable by anyone
// holding the public anon key, so admin actions (refund, invoice, ship mail)
// must verify the caller's JWT belongs to a real authenticated user (the admin
// login) — the bare anon key fails auth.getUser and is rejected.
import { createClient } from "jsr:@supabase/supabase-js@2";

export async function requireAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await client.auth.getUser(token);
  return !error && !!data.user;
}
