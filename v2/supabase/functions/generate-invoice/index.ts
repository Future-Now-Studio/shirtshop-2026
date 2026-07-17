// Generates a simple PDF invoice for an order and returns it as base64.
// Admin-triggered. VAT (19%) is shown as included in the gross total.
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const eur = (n: number) => `${n.toFixed(2)} EUR`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!(await requireAdmin(req))) return json({ error: "Unauthorized" }, 401);
    const { orderId } = await req.json();
    if (!orderId) return json({ error: "Missing orderId" }, 400);

    const { data: order, error } = await supabase
      .from("orders")
      .select(`id, created_at, customer_name, customer_email, customer_address, total, discount_amount,
               order_items(qty, unit_price, products(name), variants(colors(name)), sizes(name))`)
      .eq("id", orderId).single();
    if (error) throw error;
    const { data: settings } = await supabase.from("settings").select("vat_rate").eq("id", 1).single();
    const vatRate = Number(settings?.vat_rate ?? 0.19);

    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const P = 50; let y = 800;
    const text = (s: string, x: number, yy: number, size = 10, f = font, color = rgb(0.1, 0.1, 0.1)) =>
      page.drawText(s, { x, y: yy, size, font: f, color });

    text("Private Shirt GmbH", P, y, 16, bold, rgb(0.85, 0.1, 0.45)); y -= 16;
    text("Ballindamm 40, 20095 Hamburg · info@private-shirt.de · USt-IdNr. DE175961471", P, y, 8, font, rgb(0.4, 0.4, 0.4)); y -= 40;

    text("RECHNUNG", P, y, 20, bold); y -= 28;
    text(`Rechnungs-/Bestell-Nr.: ${order.id}`, P, y); y -= 14;
    text(`Datum: ${new Date(order.created_at).toLocaleDateString("de-DE")}`, P, y); y -= 24;

    text("Rechnungsadresse:", P, y, 10, bold); y -= 14;
    text(order.customer_name ?? "—", P, y); y -= 12;
    const addr = order.customer_address as any;
    if (addr) { text(`${addr.line1 ?? ""}`, P, y); y -= 12; text(`${addr.postal_code ?? ""} ${addr.city ?? ""}`, P, y); y -= 12; }
    text(order.customer_email ?? "", P, y); y -= 28;

    // table header
    text("Menge", P, y, 9, bold); text("Artikel", P + 60, y, 9, bold); text("Einzel", 400, y, 9, bold); text("Summe", 480, y, 9, bold);
    y -= 6; page.drawLine({ start: { x: P, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); y -= 14;

    let subtotal = 0;
    for (const it of order.order_items ?? []) {
      const line = Number(it.unit_price) * it.qty; subtotal += line;
      const label = `${it.products?.name ?? "Artikel"} (${it.variants?.colors?.name ?? ""}${it.sizes?.name ? ", " + it.sizes.name : ""})`;
      text(`${it.qty}×`, P, y); text(label.slice(0, 48), P + 60, y); text(eur(Number(it.unit_price)), 400, y); text(eur(line), 480, y);
      y -= 16; if (y < 120) { y = 800; doc.addPage([595, 842]); }
    }
    y -= 6; page.drawLine({ start: { x: P, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); y -= 18;

    const total = Number(order.total ?? subtotal);
    const discount = Number(order.discount_amount ?? 0);
    const shipping = Math.max(0, total - (subtotal - discount));
    if (discount > 0) { text("Rabatt", 400, y); text("-" + eur(discount), 480, y); y -= 14; }
    text("Zwischensumme", 400, y); text(eur(subtotal - discount), 480, y); y -= 14;
    text("Versand", 400, y); text(shipping === 0 ? "gratis" : eur(shipping), 480, y); y -= 16;
    text("Gesamt", 400, y, 11, bold); text(eur(total), 480, y, 11, bold); y -= 14;
    const vat = total - total / (1 + vatRate);
    text(`enthält ${eur(vat)} MwSt (${Math.round(vatRate * 100)}%)`, 400, y, 8, font, rgb(0.4, 0.4, 0.4)); y -= 40;

    text("Vielen Dank für deinen Einkauf bei Private Shirt!", P, y, 10, bold);

    const bytes = await doc.save();
    // chunked conversion — String.fromCharCode(...bytes) overflows the arg
    // limit on PDFs larger than ~64 KB
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return json({ pdfBase64: btoa(bin) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
