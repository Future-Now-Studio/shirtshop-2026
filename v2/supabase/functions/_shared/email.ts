// Order emails via Resend. Best effort: missing configuration skips silently,
// and callers must never let an email failure block an order.

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey || !to) return;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("ORDER_EMAIL_FROM") || "Private Shirt <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!r.ok) console.error(`resend ${r.status}: ${await r.text()}`);
}

export interface OrderMail {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  address: { line1?: string; postal_code?: string; city?: string; country?: string } | null;
  lines: { name: string; qty: number; unit: number; designElementCount: number }[];
  discount: number;
  total: number;
}

function linesTable(o: OrderMail) {
  const rows = o.lines
    .map((l) => `<tr><td>${l.qty}×</td><td>${esc(l.name)}${l.designElementCount ? ` (${l.designElementCount} Design-Element${l.designElementCount > 1 ? "e" : ""})` : ""}</td><td align="right">${eur(l.unit * l.qty)}</td></tr>`)
    .join("");
  return `<table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd">${rows}</table>`;
}

/** New-order notice for the shop owner. */
export async function sendOwnerOrderEmail(supabase: any, o: OrderMail) {
  const { data: settings } = await supabase.from("settings").select("order_email").eq("id", 1).maybeSingle();
  const to = Deno.env.get("ORDER_EMAIL_TO") || settings?.order_email;
  const itemCount = o.lines.reduce((s, l) => s + l.qty, 0);
  await sendEmail(to, `Neue Bestellung – ${eur(o.total)}`, `
    <h2>Neue Bestellung</h2>
    <p><b>Kunde:</b> ${esc(o.customerName) || "—"} (${esc(o.customerEmail) || "—"})</p>
    <p><b>Positionen:</b> ${itemCount} Stück · <b>Gesamt:</b> ${eur(o.total)}</p>
    ${linesTable(o)}
    <p>Bestell-ID: ${esc(o.id)}. Design-Dateien im Admin unter Bestellungen.</p>`);
}

/** Order confirmation for the customer (Vertragsbestätigung). */
export async function sendCustomerOrderEmail(o: OrderMail) {
  if (!o.customerEmail) return;
  const site = Deno.env.get("SITE_URL") || "https://private-shirt.de";
  const a = o.address;
  await sendEmail(o.customerEmail, `Deine Bestellung bei Private Shirt (${o.id.slice(0, 8)})`, `
    <h2>Danke für deine Bestellung!</h2>
    <p>Hallo ${esc(o.customerName)},</p>
    <p>wir haben deine Bestellung und deine Zahlung erhalten und machen uns an die Arbeit.</p>
    ${linesTable(o)}
    ${o.discount > 0 ? `<p>Gutschein: −${eur(o.discount)}</p>` : ""}
    <p><b>Gesamtbetrag: ${eur(o.total)}</b> (inkl. 19 % MwSt. und Versand)</p>
    ${a ? `<p><b>Lieferadresse:</b><br>${esc(o.customerName)}<br>${esc(a.line1)}<br>${esc(a.postal_code)} ${esc(a.city)}</p>` : ""}
    <p>Bestellnummer: ${esc(o.id)}</p>
    <p style="font-size:12px;color:#666">
      Es gelten unsere <a href="${site}/agb">AGB</a> und unsere
      <a href="${site}/widerruf">Widerrufsbelehrung</a>. Für Artikel, die nach deinen
      Vorgaben bedruckt werden, besteht gemäß § 312g Abs. 2 Nr. 1 BGB kein Widerrufsrecht.
    </p>
    <p>Viele Grüße<br>dein Private-Shirt-Team</p>`);
}
