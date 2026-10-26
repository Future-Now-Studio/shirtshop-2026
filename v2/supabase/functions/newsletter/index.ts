// Newsletter double opt-in.
//   { action: "send", email }        → mails the confirmation link for an
//                                       existing unconfirmed signup, once per
//                                       signup (no open mail relay; unconfirmed
//                                       signups are purged after 7 days).
//                                       Answers { ok, status } with status
//                                       "sent" | "recent" | "confirmed".
//   { action: "confirm", token }     → marks the signup confirmed
//                                       ({ ok, status: "confirmed" | "already" })
//   { action: "unsubscribe", token } → deletes the signup
// The signup row itself is inserted by the browser. A DB trigger lower-cases
// the address and generates the confirm token server-side, so the token only
// ever reaches the subscriber through the confirmation mail.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { esc, sendEmail } from "../_shared/email.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const site = Deno.env.get("SITE_URL") || "https://private-shirt.de";

    if (body?.action === "send") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (email.length > 254 || !EMAIL.test(email)) return json({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }, 400);
      const { data: row, error } = await supabase
        .from("newsletter_subscribers")
        .select("id, email, confirm_token, confirmed_at, confirmation_sent_at")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      if (!row) return json({ error: "Wir konnten deine Anmeldung nicht finden. Bitte versuche es noch einmal." }, 404);
      if (row.confirmed_at) return json({ ok: true, status: "confirmed" });

      // Claim the send slot atomically (parallel requests can't send twice);
      // it is released again if Resend does not accept the mail. One mail per
      // signup: anyone can sign up any address, so repeated sends would turn
      // this into a spam cannon against third parties.
      const sentAt = new Date().toISOString();
      const { data: claimed, error: claimErr } = await supabase
        .from("newsletter_subscribers")
        .update({ confirmation_sent_at: sentAt })
        .eq("id", row.id)
        .is("confirmed_at", null)
        .is("confirmation_sent_at", null)
        .select("id");
      if (claimErr) throw claimErr;
      if (!claimed?.length) return json({ ok: true, status: "recent" });

      const confirmUrl = `${site}/newsletter/bestaetigen?token=${row.confirm_token}`;
      const sent = await sendEmail(row.email, "Bitte bestätige deine Newsletter-Anmeldung", `
        <h2>Fast geschafft!</h2>
        <p>Bitte bestätige deine Anmeldung zum Newsletter von Private Shirt:</p>
        <p><a href="${esc(confirmUrl)}" style="display:inline-block;background:#e6007e;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Anmeldung bestätigen</a></p>
        <p style="font-size:12px;color:#666">Du hast dich nicht angemeldet? Dann ignoriere diese E-Mail einfach – ohne Bestätigung erhältst du keinen Newsletter.</p>`)
        .catch((e) => { console.error(e); return false; });
      if (!sent) {
        // Not sent: release the slot so the subscriber can retry right away.
        await supabase
          .from("newsletter_subscribers")
          .update({ confirmation_sent_at: row.confirmation_sent_at })
          .eq("id", row.id)
          .eq("confirmation_sent_at", sentAt);
        return json({ error: "Die Bestätigungsmail konnte gerade nicht verschickt werden. Bitte versuche es später noch einmal." }, 502);
      }
      return json({ ok: true, status: "sent" });
    }

    if (body?.action === "confirm" || body?.action === "unsubscribe") {
      const token = String(body.token ?? "");
      if (!UUID.test(token)) return json({ error: "Ungültiger Link." }, 400);
      if (body.action === "confirm") {
        // Only a token that went out by mail can confirm.
        const { data, error } = await supabase
          .from("newsletter_subscribers")
          .update({ confirmed_at: new Date().toISOString() })
          .eq("confirm_token", token)
          .is("confirmed_at", null)
          .not("confirmation_sent_at", "is", null)
          .select("id");
        if (error) throw error;
        if (data?.length) return json({ ok: true, status: "confirmed" });
        const { data: existing, error: readErr } = await supabase
          .from("newsletter_subscribers").select("confirmed_at").eq("confirm_token", token).maybeSingle();
        if (readErr) throw readErr;
        if (!existing?.confirmed_at) return json({ error: "Der Link ist ungültig oder die Anmeldung wurde bereits gelöscht." }, 404);
        return json({ ok: true, status: "already" });
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
