// Generates the PDF invoice for an order and returns it as base64.
// Admin-triggered. The invoice number is sequential and assigned once
// (issue_invoice), so regenerating yields the same number.
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} EUR`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);
    const { orderId } = await req.json();
    if (!orderId) return json({ error: "Missing orderId" }, 400);

    const { data: order, error } = await supabase
      .from("orders")
      .select(`id, created_at, shipped_at, status, customer_name, customer_email, customer_address, total,
               discount_amount, volume_discount_amount, shipping_amount, coupon_code,
               order_items(qty, unit_price, products(name), variants(colors(name)), sizes(name))`)
      .eq("id", orderId).single();
    if (error) throw error;
    if (!["paid", "in_production", "shipped", "completed", "refunded"].includes(order.status)) {
      return json({ error: "Für unbezahlte oder stornierte Bestellungen wird keine Rechnung erstellt." }, 400);
    }
    const { data: settings } = await supabase.from("settings").select("vat_rate").eq("id", 1).single();
    const vatRate = Number(settings?.vat_rate ?? 0.19);

    // Sequential invoice number, assigned once per order (§ 14 UStG).
    const { data: invoice, error: invErr } = await supabase.rpc("issue_invoice", { p_order_id: order.id });
    if (invErr) throw invErr;
    const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });

    const doc = await PDFDocument.create();
    let page = doc.addPage([595, 842]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const P = 50; let y = 800;
    const grey = rgb(0.4, 0.4, 0.4);
    const text = (s: string, x: number, yy: number, size = 10, f = font, color = rgb(0.1, 0.1, 0.1)) =>
      page.drawText(s, { x, y: yy, size, font: f, color });
    const footer = () => {
      text("Private Shirt GmbH · Ballindamm 40 · 20095 Hamburg · Geschäftsführer: Erol Aydin", P, 40, 7, font, grey);
      text("Amtsgericht Hamburg HRB 83191 · USt-IdNr. DE175961471 · info@private-shirt.de · Tel. 040 – 328 73 804", P, 30, 7, font, grey);
    };

    text("Private Shirt GmbH", P, y, 16, bold, rgb(0.85, 0.1, 0.45)); y -= 16;
    text("Ballindamm 40, 20095 Hamburg · info@private-shirt.de · USt-IdNr. DE175961471", P, y, 8, font, grey); y -= 40;

    text("RECHNUNG", P, y, 20, bold); y -= 28;
    text(`Rechnungsnummer: ${invoice.invoice_number}`, P, y, 10, bold); y -= 14;
    text(`Rechnungsdatum: ${fmtDate(invoice.issued_at)}`, P, y); y -= 14;
    text(`Liefer-/Leistungsdatum: ${order.shipped_at ? fmtDate(order.shipped_at) : "entspricht dem Rechnungsdatum"}`, P, y); y -= 14;
    text(`Bestellnummer: ${order.id}`, P, y, 9, font, grey); y -= 24;

    text("Rechnungsadresse:", P, y, 10, bold); y -= 14;
    text(order.customer_name ?? "—", P, y); y -= 12;
    const addr = order.customer_address as any;
    if (addr) { text(`${addr.line1 ?? ""}`, P, y); y -= 12; text(`${addr.postal_code ?? ""} ${addr.city ?? ""}`, P, y); y -= 12; }
    text(order.customer_email ?? "", P, y); y -= 28;

    // table header
    const header = () => {
      text("Menge", P, y, 9, bold); text("Artikel", P + 60, y, 9, bold); text("Einzel (brutto)", 380, y, 9, bold); text("Summe", 480, y, 9, bold);
      y -= 6; page.drawLine({ start: { x: P, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); y -= 14;
    };
    header();

    let subtotal = 0;
    for (const it of order.order_items ?? []) {
      if (y < 140) { footer(); page = doc.addPage([595, 842]); y = 800; header(); }
      const line = Number(it.unit_price) * it.qty; subtotal += line;
      const label = `${it.products?.name ?? "Artikel"} (${it.variants?.colors?.name ?? ""}${it.sizes?.name ? ", " + it.sizes.name : ""})`;
      text(`${it.qty}×`, P, y); text(label.slice(0, 44), P + 60, y); text(eur(Number(it.unit_price)), 380, y); text(eur(line), 480, y);
      y -= 16;
    }
    if (y < 200) { footer(); page = doc.addPage([595, 842]); y = 800; }
    y -= 6; page.drawLine({ start: { x: P, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); y -= 18;

    const total = Number(order.total ?? subtotal);
    const coupon = Number(order.discount_amount ?? 0);
    const volume = Number(order.volume_discount_amount ?? 0);
    // Orders from before shipping was stored: derive it from the total.
    const shipping = order.shipping_amount != null
      ? Number(order.shipping_amount)
      : Math.max(0, total - (subtotal - volume - coupon));
    const row = (label: string, value: string, b = false) => {
      text(label, 330, y, b ? 11 : 10, b ? bold : font); text(value, 480, y, b ? 11 : 10, b ? bold : font); y -= b ? 16 : 14;
    };
    row("Warenwert", eur(subtotal));
    if (volume > 0) row("Mengenrabatt", "-" + eur(volume));
    if (coupon > 0) row(`Gutschein${order.coupon_code ? " " + order.coupon_code : ""}`, "-" + eur(coupon));
    row("Versand", eur(shipping));
    row("Gesamtbetrag (brutto)", eur(total), true);
    const net = total / (1 + vatRate);
    row(`Nettobetrag`, eur(net));
    row(`enthaltene USt. (${Math.round(vatRate * 100)} %)`, eur(total - net));
    y -= 16;

    text(order.status === "refunded" ? "Der Betrag wurde erstattet." : "Der Betrag wurde bereits per Online-Zahlung (Stripe) beglichen.", P, y); y -= 20;
    text("Vielen Dank für deinen Einkauf bei Private Shirt!", P, y, 10, bold);
    footer();

    const bytes = await doc.save();
    // chunked conversion — String.fromCharCode(...bytes) overflows the arg
    // limit on PDFs larger than ~64 KB
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return json({ pdfBase64: btoa(bin) });
  } catch (e) {
    console.error(e);
    return json({ error: "Rechnung konnte nicht erstellt werden." }, 500);
  }
});
