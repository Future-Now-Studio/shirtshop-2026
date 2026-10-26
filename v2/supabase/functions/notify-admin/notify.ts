// Owner notification for public form submissions (contact message, bulk
// inquiry, review). Kept free of Deno APIs so it can be tested with Node.
//
// Rules: a row is mailed at most once (notified_at), only while it is less
// than an hour old (so old ids cannot be replayed to spam the owner), and
// every value from the form is HTML-escaped.
import { esc } from "../_shared/email.ts";

export type Kind = "contact" | "bulk" | "review";

const TABLE: Record<Kind, string> = { contact: "contact_messages", bulk: "bulk_inquiries", review: "reviews" };
const COLUMNS: Record<Kind, string> = {
  contact: "id, created_at, name, email, message",
  bulk: "id, created_at, anrede, vorname, nachname, firma, email, telefon, filiale, stueckzahl, textil_art, qualitaet, druckverfahren, bemerkungen, motiv_path",
  review: "id, created_at, name, rating, text, products(name)",
};
const ADMIN_PAGE: Record<Kind, string> = { contact: "messages", bulk: "inquiries", review: "reviews" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE_MS = 60 * 60 * 1000;

export interface NotifyDeps {
  sendEmail: (to: string, subject: string, html: string) => Promise<boolean>;
  /** ORDER_EMAIL_TO; falls back to settings.order_email. */
  ownerEmail?: string | null;
  siteUrl: string;
}

export type NotifyResult = "sent" | "skipped" | "not-sent";

/** Subject lines are plain text: no line breaks, bounded length. */
const subjectText = (s: unknown, max = 60) => String(s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);

const row = (label: string, value: unknown) =>
  value == null || value === "" ? "" : `<tr><td style="color:#666;padding:2px 12px 2px 0;vertical-align:top">${label}</td><td>${esc(value)}</td></tr>`;

const mailto = (email: unknown) => `<a href="mailto:${esc(email)}">${esc(email)}</a>`;

export function buildMail(kind: Kind, r: any, siteUrl: string): { subject: string; html: string } {
  const link = `<p><a href="${esc(`${siteUrl}/admin/${ADMIN_PAGE[kind]}`)}">Im Admin-Bereich öffnen</a></p>`;
  if (kind === "contact") {
    return {
      subject: `Neue Kontaktanfrage von ${subjectText(r.name)}`,
      html: `
        <h2>Neue Kontaktanfrage</h2>
        <p><b>Von:</b> ${esc(r.name)} (${mailto(r.email)})</p>
        <p style="white-space:pre-wrap;border-left:3px solid #ddd;padding-left:12px">${esc(r.message)}</p>
        ${link}`,
    };
  }
  if (kind === "bulk") {
    const person = [r.anrede, r.vorname, r.nachname].filter(Boolean).join(" ");
    const who = r.firma || person || r.email;
    return {
      subject: `Neue Großbestellungs-Anfrage: ${subjectText(who)}${r.stueckzahl ? ` (${subjectText(r.stueckzahl, 20)} Stk)` : ""}`,
      html: `
        <h2>Neue Großbestellungs-Anfrage</h2>
        <table cellpadding="0" cellspacing="0">
          ${row("Name", person)}${row("Firma", r.firma)}
          <tr><td style="color:#666;padding:2px 12px 2px 0">E-Mail</td><td>${mailto(r.email)}</td></tr>
          ${row("Telefon", r.telefon)}${row("Filiale", r.filiale)}${row("Stückzahl", r.stueckzahl)}
          ${row("Textil-Art", r.textil_art)}${row("Qualität", r.qualitaet)}${row("Druckverfahren", r.druckverfahren)}
          ${row("Motiv", r.motiv_path ? "hochgeladen (im Admin herunterladen)" : "")}
        </table>
        ${r.bemerkungen ? `<p style="white-space:pre-wrap;border-left:3px solid #ddd;padding-left:12px">${esc(r.bemerkungen)}</p>` : ""}
        ${link}`,
    };
  }
  const rating = Math.max(1, Math.min(5, Number(r.rating) || 0));
  const product = r.products?.name ?? "Produkt";
  return {
    subject: `Neue Bewertung (${rating}/5) zu ${subjectText(product)} – wartet auf Freigabe`,
    html: `
      <h2>Neue Bewertung wartet auf Freigabe</h2>
      <p><b>Produkt:</b> ${esc(product)}<br><b>Von:</b> ${esc(r.name)}<br><b>Sterne:</b> ${"★".repeat(rating)}${"☆".repeat(5 - rating)}</p>
      <p style="white-space:pre-wrap;border-left:3px solid #ddd;padding-left:12px">${esc(r.text)}</p>
      <p>Die Bewertung ist erst nach der Freigabe im Shop sichtbar.</p>
      ${link}`,
  };
}

/**
 * Mails the owner about one new row. `db` must be a service-role client.
 * Claims the row first (sets notified_at) so parallel calls send at most one
 * mail; if the mail is not accepted the claim is released again.
 */
export async function notifyAdmin(db: any, body: unknown, deps: NotifyDeps): Promise<NotifyResult> {
  const { kind, id } = (body ?? {}) as { kind?: unknown; id?: unknown };
  if (typeof kind !== "string" || !(kind in TABLE) || typeof id !== "string" || !UUID.test(id)) return "skipped";
  const k = kind as Kind;
  const table = TABLE[k];

  const claimedAt = new Date().toISOString();
  const since = new Date(Date.now() - MAX_AGE_MS).toISOString();
  const { data: claimed, error } = await db
    .from(table)
    .update({ notified_at: claimedAt })
    .eq("id", id)
    .is("notified_at", null)
    .gt("created_at", since)
    .select(COLUMNS[k])
    .maybeSingle();
  if (error) throw error;
  if (!claimed) return "skipped"; // unknown, too old or already notified

  let sent = false;
  try {
    let to = deps.ownerEmail?.trim() || null;
    if (!to) {
      const { data: settings } = await db.from("settings").select("order_email").eq("id", 1).maybeSingle();
      to = settings?.order_email?.trim() || null;
    }
    if (to) {
      const mail = buildMail(k, claimed, deps.siteUrl.replace(/\/+$/, ""));
      sent = await deps.sendEmail(to, mail.subject, mail.html);
    }
  } finally {
    // Not mailed (mail not configured, no owner address, Resend refused):
    // release the claim so the row does not look notified.
    if (!sent) await db.from(table).update({ notified_at: null }).eq("id", id).eq("notified_at", claimedAt);
  }
  return sent ? "sent" : "not-sent";
}
