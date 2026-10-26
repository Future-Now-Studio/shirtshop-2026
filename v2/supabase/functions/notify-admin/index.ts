// Notifies the shop owner by e-mail about a new contact message, bulk inquiry
// or review. Called best-effort by the storefront right after it inserted the
// row:  POST { kind: "contact" | "bulk" | "review", id: uuid }
// The row is loaded with the service role; the mail goes to ORDER_EMAIL_TO
// (or settings.order_email) at most once per row and only for rows younger
// than an hour. Always answers 200 { ok: true } so callers never block and
// nothing about the rows leaks.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";
import { notifyAdmin } from "./notify.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => null);
    const result = await notifyAdmin(supabase, body, {
      sendEmail: (to, subject, html) => sendEmail(to, subject, html),
      ownerEmail: Deno.env.get("ORDER_EMAIL_TO"),
      siteUrl: Deno.env.get("SITE_URL") || "https://private-shirt.de",
    });
    if (result === "not-sent") console.warn("notify-admin: owner mail not sent (mail not configured or refused)");
  } catch (e) {
    console.error("notify-admin", e);
  }
  return json({ ok: true });
});
