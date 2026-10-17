// Newsletter double opt-in.
//   { action: "send", email }        → mails the confirmation link for an
//                                       existing unconfirmed signup, at most
//                                       once a day (no open mail relay)
//   { action: "confirm", token }     → marks the signup confirmed
//   { action: "unsubscribe", token } → deletes the signup
// The signup row itself is inserted by the browser (RLS: unconfirmed only).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { esc, sendEmail } from "../_shared/email.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const site = Deno.env.get("SITE_URL") || "https://private-shirt.de";

    if (body?.action === "send") {
      const email = String(body.email ?? "").trim();
      const { data: row } = await supabase
        .from("newsletter_subscribers")
        .select("id, email, confirm_token, confirmed_at, confirmation_sent_at")
        .eq("email", email)
        .maybeSingle();
      // At most one confirmation mail per address and day; same answer either
      // way (no address enumeration).
      const dayAgo = Date.now() - 24 * 3600_000;
      const recentlySent = row?.confirmation_sent_at && new Date(row.confirmation_sent_at).getTime() > dayAgo;
      if (!row || row.confirmed_at || recentlySent) return json({ ok: true });
      const confirmUrl = `${site}/newsletter/bestaetigen?token=${row.confirm_token}`;
      await sendEmail(row.email, "Bitte bestätige deine Newsletter-Anmeldung", `
        <h2>Fast geschafft!</h2>
        <p>Bitte bestätige deine Anmeldung zum Newsletter von Private Shirt:</p>
        <p><a href="${esc(confirmUrl)}" style="display:inline-block;background:#e6007e;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Anmeldung bestätigen</a></p>
        <p style="font-size:12px;color:#666">Du hast dich nicht angemeldet? Dann ignoriere diese E-Mail einfach – ohne Bestätigung erhältst du keinen Newsletter.</p>`);
      await supabase.from("newsletter_subscribers").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", row.id);
      return json({ ok: true });
    }

    if (body?.action === "confirm" || body?.action === "unsubscribe") {
      const token = String(body.token ?? "");
      if (!UUID.test(token)) return json({ error: "Ungültiger Link." }, 400);
      if (body.action === "confirm") {
        const { data, error } = await supabase
          .from("newsletter_subscribers")
          .update({ confirmed_at: new Date().toISOString() })
          .eq("confirm_token", token)
          .is("confirmed_at", null)
          .select("id");
        if (error) throw error;
        if (!data?.length) {
          const { data: existing } = await supabase.from("newsletter_subscribers").select("id").eq("confirm_token", token).maybeSingle();
          if (!existing) return json({ error: "Der Link ist ungültig oder die Anmeldung wurde bereits gelöscht." }, 404);
        }
        return json({ ok: true });
      }
      const { error } = await supabase.from("newsletter_subscribers").delete().eq("confirm_token", token);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unbekannte Aktion." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Das hat nicht geklappt. Bitte später erneut versuchen." }, 500);
  }
});
