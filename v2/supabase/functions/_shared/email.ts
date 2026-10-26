// Order emails via Resend. Best effort: callers must never let an email
// failure block an order. Missing configuration is logged loudly and reported
// as `false`, so callers can record it (orders.email_sent).

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

export interface MailAttachment {
  filename: string;
  content: string; // base64
}

/**
 * Sends one mail via Resend. Returns true when Resend accepted it, false when
 * mail is not configured, the request failed or Resend refused it (the reason
 * is logged). Never throws.
 */
export async function sendEmail(to: string, subject: string, html: string, attachments?: MailAttachment[]): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  // No fallback sender: Resend's shared onboarding address only delivers to
  // the account owner, so customer mails would be lost without a trace.
  const from = Deno.env.get("ORDER_EMAIL_FROM");
  if (!apiKey || !from) {
    console.error(`mail not sent ("${subject}"): ${!apiKey ? "RESEND_API_KEY" : "ORDER_EMAIL_FROM"} is not set`);
    return false;
  }
  if (!to) {
    console.error(`mail not sent ("${subject}"): no recipient`);
    return false;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(attachments?.length ? { attachments } : {}),
      }),
    });
    if (!r.ok) console.error(`resend ${r.status}: ${await r.text()}`);
    return r.ok;
  } catch (e) {
    console.error("resend request failed:", e);
    return false;
  }
}

interface MailSettings {
  orderEmail: string | null;
  vatRate: number;
  deliveryTime: string | null;
}

async function mailSettings(supabase: any): Promise<MailSettings> {
  const { data } = await supabase.from("settings").select("order_email, vat_rate, delivery_time").eq("id", 1).maybeSingle();
  return {
    orderEmail: data?.order_email ?? null,
    vatRate: Number(data?.vat_rate ?? 0.19),
    deliveryTime: data?.delivery_time?.trim() || null,
  };
}

/** Shop owner's address: ORDER_EMAIL_TO, else Admin → Einstellungen. */
async function ownerAddress(supabase: any): Promise<string> {
  return Deno.env.get("ORDER_EMAIL_TO") || (await mailSettings(supabase)).orderEmail || "";
}

/** Plain-text alert to the shop owner (reconciliation, failures). */
export async function sendOwnerAlert(supabase: any, subject: string, text: string): Promise<boolean> {
  const html = text.split("\n").map((l) => `<p>${esc(l)}</p>`).join("");
  return sendEmail(await ownerAddress(supabase), subject, html);
}

export interface OrderMail {
  id: string;
  orderNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
  address: { line1?: string; postal_code?: string; city?: string; country?: string } | null;
  lines: { name: string; qty: number; unit: number; designElementCount: number }[];
  subtotal: number;
  volumeDiscount: number;
  discount: number;
  couponCode: string | null;
  shipping: number | null; // null for intents created before shipping was stored
  total: number;
  reviewReason: string | null;
}

const orderRef = (o: OrderMail) => o.orderNumber || o.id.slice(0, 8);
const vatPercent = (rate: number) => `${String(Math.round(rate * 1000) / 10).replace(".", ",")} %`;

function linesTable(o: OrderMail) {
  const rows = o.lines
    .map((l) => `<tr><td>${l.qty}×</td><td>${esc(l.name)}${l.designElementCount ? ` (${l.designElementCount} Design-Element${l.designElementCount > 1 ? "e" : ""})` : ""}</td><td align="right">${eur(l.unit * l.qty)}</td></tr>`)
    .join("");
  return `<table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd">${rows}</table>`;
}

/** Zwischensumme, Mengenrabatt, Gutschein, Versand and total incl. VAT. */
function totalsTable(o: OrderMail, vatRate: number) {
  const row = (label: string, value: string, bold = false) =>
    `<tr><td>${bold ? `<b>${label}</b>` : label}</td><td align="right">${bold ? `<b>${value}</b>` : value}</td></tr>`;
  const vat = o.total - o.total / (1 + vatRate);
  return `<table cellpadding="4" style="border-collapse:collapse;margin-top:8px">
    ${row("Zwischensumme", eur(o.subtotal))}
    ${o.volumeDiscount > 0 ? row("Mengenrabatt", `−${eur(o.volumeDiscount)}`) : ""}
    ${o.discount > 0 ? row(`Gutschein${o.couponCode ? ` ${esc(o.couponCode)}` : ""}`, `−${eur(o.discount)}`) : ""}
    ${o.shipping != null ? row("Versand", o.shipping > 0 ? eur(o.shipping) : "gratis") : ""}
    ${row("Gesamtbetrag", eur(o.total), true)}
    ${row(`enthaltene MwSt. (${vatPercent(vatRate)})`, eur(vat))}
  </table>`;
}

/**
 * New-order notice for the shop owner. `customerMailSent: false` adds a
 * warning that the customer has no confirmation yet.
 */
export async function sendOwnerOrderEmail(supabase: any, o: OrderMail, customerMailSent = true): Promise<boolean> {
  const settings = await mailSettings(supabase);
  const to = Deno.env.get("ORDER_EMAIL_TO") || settings.orderEmail || "";
  const itemCount = o.lines.reduce((s, l) => s + l.qty, 0);
  const warnings = [
    o.reviewReason ? `Bitte vor der Produktion prüfen: ${esc(o.reviewReason)}` : "",
    customerMailSent ? "" : "Die Bestellbestätigung an den Kunden konnte nicht gesendet werden. Bitte den Kunden kontaktieren.",
  ].filter(Boolean);
  return sendEmail(to, `${o.reviewReason ? "⚠️ Prüfen: " : ""}Neue Bestellung ${orderRef(o)} – ${eur(o.total)}`, `
    <h2>Neue Bestellung ${esc(orderRef(o))}</h2>
    ${warnings.map((w) => `<p style="padding:8px;background:#fff3cd;border:1px solid #e0a800"><b>⚠️ ${w}</b></p>`).join("")}
    <p><b>Kunde:</b> ${esc(o.customerName) || "—"} (${esc(o.customerEmail) || "—"})</p>
    <p><b>Positionen:</b> ${itemCount} Stück · <b>Gesamt:</b> ${eur(o.total)}</p>
    ${linesTable(o)}
    ${totalsTable(o, settings.vatRate)}
    <p>Bestellnummer: ${esc(orderRef(o))} (ID ${esc(o.id)}). Design-Dateien im Admin unter Bestellungen.</p>`);
}

/** Order confirmation for the customer (Vertragsbestätigung). True = accepted by Resend. */
export async function sendCustomerOrderEmail(supabase: any, o: OrderMail): Promise<boolean> {
  if (!o.customerEmail) return false;
  const settings = await mailSettings(supabase);
  const site = Deno.env.get("SITE_URL") || "https://private-shirt.de";
  const a = o.address;
  return sendEmail(o.customerEmail, `Deine Bestellung bei Private Shirt (${orderRef(o)})`, `
    <h2>Danke für deine Bestellung!</h2>
    <p>Hallo ${esc(o.customerName)},</p>
    <p>wir haben deine Bestellung und deine Zahlung erhalten und machen uns an die Arbeit.</p>
    <p><b>Bestellnummer: ${esc(orderRef(o))}</b></p>
    ${linesTable(o)}
    ${totalsTable(o, settings.vatRate)}
    ${a ? `<p><b>Lieferadresse:</b><br>${esc(o.customerName)}<br>${esc(a.line1)}<br>${esc(a.postal_code)} ${esc(a.city)}</p>` : ""}
    ${settings.deliveryTime ? `<p><b>Lieferzeit:</b> ${esc(settings.deliveryTime)}</p>` : ""}
    <p>Bei Rückfragen gib bitte immer deine Bestellnummer an.</p>
    <p style="font-size:12px;color:#666">
      Es gelten unsere <a href="${site}/agb">AGB</a> und unsere
      <a href="${site}/widerruf">Widerrufsbelehrung</a>. Für Artikel, die nach deinen
      Vorgaben bedruckt werden, besteht gemäß § 312g Abs. 2 Nr. 1 BGB kein Widerrufsrecht.
    </p>
    <p>Viele Grüße<br>dein Private-Shirt-Team</p>`);
}
