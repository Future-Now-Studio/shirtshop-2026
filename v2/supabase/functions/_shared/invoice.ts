// Invoice and correction-invoice PDFs (§ 14 UStG, GoBD). The first request
// issues the number (gap-free: issue_invoice / issue_credit_note), renders the
// PDF and stores it in the private "invoices" bucket; every later request
// returns the stored file unchanged, so a document never changes after issue.
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1?target=denonext";

/** Seller details printed on every document — change them here only. */
export const COMPANY = {
  name: "Private Shirt GmbH",
  street: "Ballindamm 40",
  city: "20095 Hamburg",
  managingDirector: "Erol Aydin",
  register: "Amtsgericht Hamburg HRB 83191",
  vatId: "DE175961471",
  email: "info@private-shirt.de",
  phone: "040 – 328 73 804",
};

/** Error with an HTTP status and a message that may be shown to the admin. */
export class DocError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface IssuedDocument {
  number: string;
  issuedAt: string;
  pdf: Uint8Array;
}

const BUCKET = "invoices";
const INVOICEABLE = ["paid", "in_production", "shipped", "completed", "refunded"];
const DEFAULT_VAT = 0.19;
const PLACEHOLDER = "XX-0000-00000";

const ORDER_SELECT = `id, order_number, status, created_at, shipped_at, anonymized_at, customer_name, customer_email,
  customer_address, total, discount_amount, volume_discount_amount, shipping_amount, coupon_code,
  stripe_payment_intent_id, order_items(qty, unit_price, design_data, product_name, products(name), variants(colors(name)), sizes(name))`;

// ---------------------------------------------------------------------------
// Text sanitising: Helvetica (a standard PDF font) can only encode WinAnsi.
// Other characters are transliterated (ı→i, ł→l, Cyrillic/Greek → Latin),
// stripped of accents (Ş→S, ğ→g) or dropped (emoji), so no customer name or
// product text can make the PDF fail.
const SPECIAL = new Map<string, string>(Object.entries({
  "ı": "i", "İ": "I", "ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ħ": "h", "Ħ": "H", "ŧ": "t", "Ŧ": "T",
  "ŋ": "ng", "Ŋ": "Ng", "ĸ": "k", "ŀ": "l", "Ŀ": "L", "ẞ": "SS", "ə": "e", "Ə": "E", "ʻ": "'", "ʼ": "'",
  "‐": "-", "‑": "-", "‒": "-", "―": "-", "−": "-", "′": "'", "″": '"',
}));
const CYRILLIC = "а:a б:b в:v г:g д:d е:e ё:e ж:zh з:z и:i й:y к:k л:l м:m н:n о:o п:p р:r с:s т:t у:u ф:f х:kh ц:ts ч:ch ш:sh щ:shch ъ: ы:y ь: э:e ю:yu я:ya є:ye і:i ї:yi ґ:g ђ:dj ј:j љ:lj њ:nj ћ:c џ:dz ў:u";
const GREEK = "α:a β:v γ:g δ:d ε:e ζ:z η:i θ:th ι:i κ:k λ:l μ:m ν:n ξ:x ο:o π:p ρ:r σ:s ς:s τ:t υ:y φ:f χ:ch ψ:ps ω:o";
for (const pair of `${CYRILLIC} ${GREEK}`.split(" ")) {
  const [lower, latin] = pair.split(":");
  SPECIAL.set(lower, latin);
  const upper = lower.toUpperCase();
  if (upper !== lower) SPECIAL.set(upper, latin ? latin[0].toUpperCase() + latin.slice(1) : "");
}

export function makeSanitizer(supported: Set<number>) {
  const ok = (ch: string) => supported.has(ch.codePointAt(0)!);
  return (input: unknown): string => {
    let out = "";
    for (const ch of String(input ?? "").replace(/[\t\r\n]+/g, " ")) {
      if (ok(ch)) { out += ch; continue; }
      const mapped = SPECIAL.get(ch);
      if (mapped !== undefined) { out += mapped; continue; }
      for (const c of ch.normalize("NFKD").replace(/\p{M}/gu, "")) {
        if (ok(c)) out += c;
        else out += SPECIAL.get(c) ?? "";
      }
    }
    return out.replace(/ {2,}/g, " ").trim();
  };
}

// ---------------------------------------------------------------------------
// Layout helpers
const A4: [number, number] = [595, 842];
const LEFT = 50;
const RIGHT = 545;
const INK = rgb(0.1, 0.1, 0.1);
const GREY = rgb(0.4, 0.4, 0.4);
const LINE = rgb(0.8, 0.8, 0.8);
const BRAND = rgb(0.85, 0.1, 0.45);

const eur = (n: number) => `${n < 0 ? "-" : ""}${Math.abs(n).toFixed(2).replace(".", ",")} EUR`;
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
const fmtMonth = (d: string | Date) =>
  new Date(d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", month: "long", year: "numeric" });
const round2 = (n: number) => Math.round(n * 100) / 100;

async function createPen(title: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setAuthor(COMPANY.name);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const clean = makeSanitizer(new Set(font.getCharacterSet()));
  let page = doc.addPage(A4);

  const pen = {
    doc, font, bold, clean,
    y: 800,
    at(s: unknown, x: number, y: number, size = 10, f = font, color = INK) {
      page.drawText(clean(s), { x, y, size, font: f, color });
    },
    text(s: unknown, x: number, size = 10, f = font, color = INK) {
      pen.at(s, x, pen.y, size, f, color);
    },
    /** Right-aligned so that the text ends at x. */
    right(s: unknown, x: number, size = 10, f = font, color = INK) {
      const t = clean(s);
      page.drawText(t, { x: x - f.widthOfTextAtSize(t, size), y: pen.y, size, font: f, color });
    },
    /** Splits text into lines that fit maxWidth (long words are cut). */
    wrap(s: unknown, maxWidth: number, size = 10, f = font): string[] {
      const width = (t: string) => f.widthOfTextAtSize(t, size);
      const lines: string[] = [];
      let cur = "";
      for (let word of clean(s).split(" ")) {
        const next = cur ? `${cur} ${word}` : word;
        if (width(next) <= maxWidth) { cur = next; continue; }
        if (cur) lines.push(cur);
        while (width(word) > maxWidth) {
          let i = word.length - 1;
          while (i > 1 && width(word.slice(0, i)) > maxWidth) i--;
          lines.push(word.slice(0, i));
          word = word.slice(i);
        }
        cur = word;
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [""];
    },
    rule() {
      page.drawLine({ start: { x: LEFT, y: pen.y }, end: { x: RIGHT, y: pen.y }, thickness: 0.5, color: LINE });
    },
    footer() {
      pen.at(`${COMPANY.name} · ${COMPANY.street} · ${COMPANY.city} · Geschäftsführer: ${COMPANY.managingDirector}`, LEFT, 40, 7, font, GREY);
      pen.at(`${COMPANY.register} · USt-IdNr. ${COMPANY.vatId} · ${COMPANY.email} · Tel. ${COMPANY.phone}`, LEFT, 30, 7, font, GREY);
    },
    /** Starts a new page when less than `need` points are left above the footer. */
    ensure(need: number, onNewPage?: () => void) {
      if (pen.y - need >= 70) return;
      pen.footer();
      page = doc.addPage(A4);
      pen.y = 800;
      onNewPage?.();
    },
  };
  return pen;
}
type Pen = Awaited<ReturnType<typeof createPen>>;

function letterhead(pen: Pen) {
  pen.text(COMPANY.name, LEFT, 16, pen.bold, BRAND); pen.y -= 16;
  pen.text(`${COMPANY.street}, ${COMPANY.city} · ${COMPANY.email} · USt-IdNr. ${COMPANY.vatId}`, LEFT, 8, pen.font, GREY);
  pen.y -= 40;
}

function recipient(pen: Pen, order: any) {
  pen.text("Rechnungsempfänger:", LEFT, 10, pen.bold); pen.y -= 14;
  const a = (order.customer_address ?? {}) as Record<string, string | undefined>;
  const country = (a.country ?? "").trim();
  const lines = [
    order.customer_name || (order.anonymized_at ? "(Kundendaten anonymisiert)" : "—"),
    a.company, a.line1, a.line2,
    [a.postal_code, a.city].filter(Boolean).join(" "),
    country && !["DE", "Deutschland", "Germany"].includes(country) ? country : "",
  ].filter((l) => l && String(l).trim());
  for (const l of lines) {
    for (const w of pen.wrap(l, 300)) { pen.text(w, LEFT); pen.y -= 12; }
  }
  if (order.customer_email) { pen.text(order.customer_email, LEFT, 9, pen.font, GREY); pen.y -= 12; }
  pen.y -= 16;
}

/** Key/value lines below the document title. */
function meta(pen: Pen, rows: [string, string, boolean?][]) {
  for (const [k, v, b] of rows) {
    pen.text(`${k}:`, LEFT, 10, b ? pen.bold : pen.font);
    pen.text(v, LEFT + 135, 10, b ? pen.bold : pen.font);
    pen.y -= 14;
  }
  pen.y -= 12;
}

function totalsRow(pen: Pen, label: string, value: number, strong = false) {
  const f = strong ? pen.bold : pen.font;
  const size = strong ? 11 : 10;
  pen.text(label, 300, size, f);
  pen.right(eur(value), RIGHT, size, f);
  pen.y -= strong ? 16 : 14;
}

function orderNo(order: any) {
  return order.order_number ?? order.id;
}

async function renderInvoice(order: any, vatRate: number, number: string, issuedAt: string): Promise<Uint8Array> {
  const pen = await createPen(`Rechnung ${number}`);
  letterhead(pen);
  pen.text("RECHNUNG", LEFT, 20, pen.bold); pen.y -= 28;
  // § 14 Abs. 4 Nr. 6 UStG / § 31 Abs. 4 UStDV: delivery date, or the
  // calendar month of delivery while the order has not shipped yet.
  meta(pen, [
    ["Rechnungsnummer", number, true],
    ["Rechnungsdatum", fmtDate(issuedAt)],
    order.shipped_at
      ? ["Liefer-/Leistungsdatum", fmtDate(order.shipped_at)]
      : ["Liefer-/Leistungszeitraum", fmtMonth(issuedAt)],
    ["Bestellnummer", orderNo(order)],
    ["Bestelldatum", fmtDate(order.created_at)],
  ]);
  recipient(pen, order);

  const header = () => {
    pen.text("Menge", LEFT, 9, pen.bold);
    pen.text("Artikel", LEFT + 45, 9, pen.bold);
    pen.right("Einzel (brutto)", 455, 9, pen.bold);
    pen.right("Summe", RIGHT, 9, pen.bold);
    pen.y -= 6; pen.rule(); pen.y -= 14;
  };
  header();

  let subtotal = 0;
  for (const it of order.order_items ?? []) {
    const unit = Number(it.unit_price);
    const line = round2(unit * it.qty);
    subtotal += line;
    const variant = [it.variants?.colors?.name, it.sizes?.name].filter(Boolean).join(", ");
    // product_name: snapshot taken at checkout (survives renames/deletions)
    const label = `${it.product_name ?? it.products?.name ?? "Artikel"}${variant ? ` (${variant})` : ""}${it.design_data?.designId ? " – mit individuellem Druck" : ""}`;
    const lines = pen.wrap(label, 240);
    pen.ensure(lines.length * 12 + 6, header);
    pen.text(`${it.qty}×`, LEFT);
    pen.right(eur(unit), 455);
    pen.right(eur(line), RIGHT);
    for (const l of lines) { pen.text(l, LEFT + 45); pen.y -= 12; }
    pen.y -= 4;
  }
  subtotal = round2(subtotal);

  pen.ensure(170);
  pen.y -= 2; pen.rule(); pen.y -= 18;

  const total = Number(order.total ?? subtotal);
  const coupon = Number(order.discount_amount ?? 0);
  const volume = Number(order.volume_discount_amount ?? 0);
  // Orders from before shipping was stored: derive it from the total.
  const shipping = order.shipping_amount != null
    ? Number(order.shipping_amount)
    : Math.max(0, round2(total - (subtotal - volume - coupon)));
  totalsRow(pen, "Warenwert", subtotal);
  if (volume > 0) totalsRow(pen, "Mengenrabatt", -volume);
  if (coupon > 0) totalsRow(pen, `Gutschein${order.coupon_code ? " " + order.coupon_code : ""}`, -coupon);
  totalsRow(pen, "Versand", shipping);
  totalsRow(pen, "Gesamtbetrag (brutto)", total, true);
  const net = round2(total / (1 + vatRate));
  totalsRow(pen, "Nettobetrag", net);
  totalsRow(pen, `enthaltene USt. (${Math.round(vatRate * 100)} %)`, round2(total - net));
  pen.y -= 16;

  pen.text(order.stripe_payment_intent_id
    ? "Der Betrag wurde bereits per Online-Zahlung (Stripe) beglichen."
    : "Der Betrag wurde bereits beglichen.", LEFT);
  pen.y -= 20;
  pen.text("Vielen Dank für deinen Einkauf bei Private Shirt!", LEFT, 10, pen.bold);
  pen.footer();
  return await pen.doc.save();
}

async function renderCreditNote(
  order: any, refund: any, invoice: { number: string; issuedAt: string }, vatRate: number, number: string, issuedAt: string,
): Promise<Uint8Array> {
  // A full refund after partial ones only covers the remainder: that is a
  // correction, not a cancellation of the whole invoice.
  const remainderOnly = Math.abs(Number(refund.amount) - Number(order.total)) >= 0.005;
  const storno = refund.full_refund && !remainderOnly;
  const title = storno ? "STORNORECHNUNG" : "RECHNUNGSKORREKTUR";
  const pen = await createPen(`${storno ? "Stornorechnung" : "Rechnungskorrektur"} ${number}`);
  letterhead(pen);
  pen.text(title, LEFT, 20, pen.bold); pen.y -= 28;
  meta(pen, [
    ["Nummer", number, true],
    ["Datum", fmtDate(issuedAt)],
    ["Zu Rechnung", `${invoice.number} vom ${fmtDate(invoice.issuedAt)}`],
    ["Bestellnummer", orderNo(order)],
  ]);
  recipient(pen, order);

  pen.text("Position", LEFT, 9, pen.bold);
  pen.right("Betrag (brutto)", RIGHT, 9, pen.bold);
  pen.y -= 6; pen.rule(); pen.y -= 14;

  const amount = -Number(refund.amount);
  const label = storno
    ? `Stornierung der Rechnung ${invoice.number} (vollständige Erstattung)`
    : refund.full_refund
      ? `Erstattung des Restbetrags zu Rechnung ${invoice.number} (nach Teilerstattungen)`
      : `Teilerstattung zu Rechnung ${invoice.number}${refund.reason ? `: ${refund.reason}` : ""}`;
  pen.right(eur(amount), RIGHT);
  for (const l of pen.wrap(label, 380)) { pen.ensure(14); pen.text(l, LEFT); pen.y -= 12; }
  pen.y -= 4;

  pen.ensure(120);
  pen.y -= 2; pen.rule(); pen.y -= 18;
  totalsRow(pen, "Korrekturbetrag (brutto)", amount, true);
  const net = round2(amount / (1 + vatRate));
  totalsRow(pen, "Nettobetrag", net);
  totalsRow(pen, `enthaltene USt. (${Math.round(vatRate * 100)} %)`, round2(amount - net));
  pen.y -= 16;

  pen.text("Der Betrag wird auf das ursprünglich verwendete Zahlungsmittel erstattet.", LEFT);
  pen.footer();
  return await pen.doc.save();
}

// ---------------------------------------------------------------------------
// Storage

async function download(supabase: any, path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error(`missing ${path}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Stores a new document; if a concurrent request stored it first, returns that file. */
async function store(supabase: any, path: string, pdf: Uint8Array): Promise<Uint8Array> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: false });
  if (!error) return pdf;
  const existing = await download(supabase, path).catch(() => null);
  if (existing) return existing;
  throw error;
}

async function loadOrder(supabase: any, orderId: string) {
  const { data, error } = await supabase.from("orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle();
  if (error) throw error;
  if (!data) throw new DocError(404, "Bestellung nicht gefunden.");
  return data;
}

async function currentVatRate(supabase: any): Promise<number> {
  const { data } = await supabase.from("settings").select("vat_rate").eq("id", 1).maybeSingle();
  return Number(data?.vat_rate ?? DEFAULT_VAT);
}

// ---------------------------------------------------------------------------
// Public API

/** Returns the order's invoice PDF; issues, renders and stores it on first call. */
export async function ensureInvoice(supabase: any, orderId: string): Promise<IssuedDocument> {
  const { data: existing, error } = await supabase
    .from("invoices").select("invoice_number, issued_at, pdf_path, vat_rate").eq("order_id", orderId).maybeSingle();
  if (error) throw error;
  if (existing?.pdf_path) {
    return { number: existing.invoice_number, issuedAt: existing.issued_at, pdf: await download(supabase, existing.pdf_path) };
  }

  const order = await loadOrder(supabase, orderId);
  const vatRate = existing?.vat_rate != null ? Number(existing.vat_rate) : await currentVatRate(supabase);
  let inv = existing;
  if (!inv) {
    if (!INVOICEABLE.includes(order.status)) {
      throw new DocError(400, "Für unbezahlte oder stornierte Bestellungen wird keine Rechnung erstellt.");
    }
    if (order.anonymized_at) {
      throw new DocError(400, "Die Kundendaten dieser Bestellung wurden anonymisiert – es kann keine neue Rechnung mehr erstellt werden.");
    }
    // Refunds issue invoice + correction together; a refunded order without
    // recorded refunds (refunded before documents existed) gets none.
    if (order.status === "refunded") {
      const { count } = await supabase
        .from("order_refunds").select("id", { count: "exact", head: true }).eq("order_id", orderId);
      if (!count) throw new DocError(400, "Die Bestellung wurde ohne Rechnung vollständig erstattet – eine Rechnung ist nicht nötig.");
    }
    // Render once before a number exists: a number is only issued for a
    // document that can actually be produced (no gaps from render errors).
    await renderInvoice(order, vatRate, PLACEHOLDER, new Date().toISOString());
    const { data, error: issueErr } = await supabase.rpc("issue_invoice", { p_order_id: orderId });
    if (issueErr) throw issueErr;
    inv = data;
  }

  const path = `${inv.invoice_number}.pdf`;
  const pdf = await store(supabase, path, await renderInvoice(order, vatRate, inv.invoice_number, inv.issued_at));
  const { error: upErr } = await supabase
    .from("invoices").update({ pdf_path: path, vat_rate: vatRate }).eq("order_id", orderId).is("pdf_path", null);
  if (upErr) console.error("invoice pdf_path", upErr);
  return { number: inv.invoice_number, issuedAt: inv.issued_at, pdf };
}

/**
 * Returns the correction invoice (Stornorechnung / Rechnungskorrektur) for a
 * refund; issues, renders and stores it on first call. The original invoice is
 * issued first if the order never had one, so the correction can refer to it.
 */
export async function ensureCreditNote(supabase: any, refundId: string): Promise<IssuedDocument> {
  const { data: refund, error } = await supabase.from("order_refunds").select("*").eq("id", refundId).maybeSingle();
  if (error) throw error;
  if (!refund) throw new DocError(404, "Erstattung nicht gefunden.");
  if (refund.credit_note_pdf_path) {
    return {
      number: refund.credit_note_number,
      issuedAt: refund.credit_note_issued_at,
      pdf: await download(supabase, refund.credit_note_pdf_path),
    };
  }

  const invoice = await ensureInvoice(supabase, refund.order_id);
  const { data: invRow } = await supabase.from("invoices").select("vat_rate").eq("order_id", refund.order_id).maybeSingle();
  const vatRate = invRow?.vat_rate != null ? Number(invRow.vat_rate) : await currentVatRate(supabase);
  const order = await loadOrder(supabase, refund.order_id);

  let issued = refund;
  if (!issued.credit_note_number) {
    await renderCreditNote(order, refund, invoice, vatRate, PLACEHOLDER, new Date().toISOString());
    const { data, error: issueErr } = await supabase.rpc("issue_credit_note", { p_refund_id: refundId });
    if (issueErr) throw issueErr;
    issued = data;
  }

  const path = `${issued.credit_note_number}.pdf`;
  const pdf = await store(
    supabase, path,
    await renderCreditNote(order, refund, invoice, vatRate, issued.credit_note_number, issued.credit_note_issued_at),
  );
  const { error: upErr } = await supabase
    .from("order_refunds").update({ credit_note_pdf_path: path }).eq("id", refundId).is("credit_note_pdf_path", null);
  if (upErr) console.error("credit note pdf_path", upErr);
  return { number: issued.credit_note_number, issuedAt: issued.credit_note_issued_at, pdf };
}

/** Base64 for JSON responses and mail attachments (chunked: large PDFs). */
export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
