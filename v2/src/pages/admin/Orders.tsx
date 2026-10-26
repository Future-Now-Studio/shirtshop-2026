import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  AlertTriangle, ChevronRight, ChevronLeft, Download, FileText, Mail, MailWarning, Package, Search, ShieldOff, StickyNote, Truck, Undo2,
} from "lucide-react";
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";
import { invokeFn } from "@/lib/functions";
import { dbErrorMessage, eur } from "@/lib/utils";
import { MIN_OK_DPI } from "@/lib/designer-print";

const PAGE_SIZE = 25;
const STATUSES = ["pending", "paid", "in_production", "shipped", "completed", "cancelled", "refunded"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "offen", paid: "bezahlt", in_production: "in produktion", shipped: "versendet",
  completed: "abgeschlossen", cancelled: "storniert", refunded: "erstattet",
};
const STATUS_CLS: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  paid: "bg-green-100 text-green-800",
  in_production: "bg-amber-100 text-amber-800",
  shipped: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-rose-100 text-rose-800",
};
// Mirrors the DB guard (guard_order_update): refunds and cancelling paid
// orders go through "Rückerstattung" (Stripe + stock), never this dropdown.
const NEXT_STATUS: Record<string, string[]> = {
  pending: ["paid", "cancelled"],
  paid: ["in_production", "shipped", "completed"],
  in_production: ["paid", "shipped", "completed"],
  shipped: ["in_production", "completed"],
  completed: ["shipped"],
  cancelled: [],
  refunded: [],
};
const PAID = ["paid", "in_production", "shipped", "completed"];
const VIEW_ORDER = ["front", "back", "left", "right"];
const VIEW_LABEL: Record<string, string> = { front: "Vorne", back: "Hinten", left: "Links", right: "Rechts" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const orderNo = (o: { order_number?: string | null; id: string }) => o.order_number ?? o.id.slice(0, 8);
// review_reason is German free text; the stripe-webhook writes chargebacks as
// "Zahlung angefochten (Chargeback): …" (appended with "; " to other reasons).
const isChargeback = (reason?: string | null) => !!reason?.includes("(Chargeback)");
const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);
const round2 = (n: number) => Math.round(n * 100) / 100;

function fmtDate(s: string) {
  return new Date(s).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}
function fmtDay(s: string) {
  return new Date(s).toLocaleDateString("de-DE");
}

function downloadPdf(base64: string, filename: string) {
  const a = document.createElement("a");
  a.href = `data:application/pdf;base64,${base64}`;
  a.download = filename;
  a.click();
}

/** Semicolon CSV with BOM so Excel opens umlauts and columns correctly. */
function downloadCsv(header: string[], rows: unknown[][], filename: string) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const text = [header.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
}
const num = (n: unknown) => Number(n ?? 0).toFixed(2).replace(".", ",");

/** Reads every row of a query past PostgREST's 1000-row page limit. */
async function fetchAll(build: (from: number, to: number) => any): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={"rounded-full px-2.5 py-0.5 text-xs font-medium " + (STATUS_CLS[status] ?? "")}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// List

interface Filters { q: string; status: string; page: number }

function applyFilters(query: any, f: Filters) {
  if (f.status === "review") query = query.not("review_reason", "is", null);
  else if (f.status) query = query.eq("status", f.status);
  const q = f.q.trim();
  if (UUID.test(q)) return query.eq("id", q);
  // strip characters that have a meaning in PostgREST's or() syntax
  const term = q.replace(/[,()*%\\:"]/g, " ").trim();
  if (term) {
    query = query.or(["customer_name", "customer_email", "order_number"].map((c) => `${c}.ilike."*${term}*"`).join(","));
  }
  return query;
}

async function fetchOrders(f: Filters) {
  const from = f.page * PAGE_SIZE;
  const { data, error, count } = await applyFilters(
    supabase.from("orders").select(
      "id, order_number, created_at, status, customer_name, customer_email, total, refunded_amount, review_reason, email_sent, anonymized_at",
      { count: "exact" },
    ),
    f,
  ).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as any[], count: count ?? 0 };
}

async function exportOrdersCsv(f: Filters) {
  const rows = await fetchAll((from, to) =>
    applyFilters(
      supabase.from("orders").select(
        "id, order_number, created_at, status, customer_name, customer_email, customer_address, total, shipping_amount, discount_amount, volume_discount_amount, coupon_code, refunded_amount, stripe_payment_intent_id, anonymized_at, invoices(invoice_number)",
      ),
      f,
    ).order("created_at", { ascending: false }).range(from, to));
  downloadCsv(
    ["Bestellnummer", "Datum", "Status", "Kunde", "E-Mail", "PLZ", "Ort", "Land", "Gesamt brutto", "Versand", "Gutschein", "Gutscheincode", "Mengenrabatt", "Erstattet", "Rechnung", "Stripe-Zahlung", "Bestell-ID"],
    rows.map((o) => [
      orderNo(o), fmtDate(o.created_at), STATUS_LABEL[o.status] ?? o.status,
      o.anonymized_at ? "(anonymisiert)" : o.customer_name, o.customer_email,
      o.customer_address?.postal_code, o.customer_address?.city, o.customer_address?.country,
      num(o.total), o.shipping_amount == null ? "" : num(o.shipping_amount), num(o.discount_amount), o.coupon_code,
      num(o.volume_discount_amount), num(o.refunded_amount), one(o.invoices as any)?.invoice_number,
      o.stripe_payment_intent_id, o.id,
    ]),
    `bestellungen-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

/** All invoices and correction invoices issued in a month, for bookkeeping. */
async function exportDocumentsCsv(month: string) {
  const start = new Date(`${month}-01T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const range = [start.toISOString(), end.toISOString()];
  const [invoices, refunds] = await Promise.all([
    fetchAll((from, to) => supabase.from("invoices")
      .select("invoice_number, issued_at, vat_rate, orders(id, order_number, customer_name, total, stripe_payment_intent_id)")
      .gte("issued_at", range[0]).lt("issued_at", range[1]).order("issued_at").range(from, to)),
    fetchAll((from, to) => supabase.from("order_refunds")
      .select("credit_note_number, credit_note_issued_at, amount, full_refund, reason, stripe_refund_id, orders(id, order_number, customer_name, stripe_payment_intent_id, invoices(invoice_number, vat_rate))")
      .not("credit_note_number", "is", null)
      .gte("credit_note_issued_at", range[0]).lt("credit_note_issued_at", range[1]).order("credit_note_issued_at").range(from, to)),
  ]);
  const row = (kind: string, no: string, date: string, order: any, gross: number, vat: number, ref: string, payment: string) => {
    const net = round2(gross / (1 + vat));
    return [kind, no, fmtDay(date), order ? orderNo(order) : "", order?.customer_name ?? "(anonymisiert)", num(gross), num(net), num(gross - net), `${Math.round(vat * 100)} %`, ref, payment];
  };
  const rows = [
    ...invoices.map((i) => {
      const o = one(i.orders as any) as any;
      return row("Rechnung", i.invoice_number, i.issued_at, o, Number(o?.total ?? 0), Number(i.vat_rate ?? 0.19), "", o?.stripe_payment_intent_id ?? "");
    }),
    ...refunds.map((r) => {
      const o = one(r.orders as any) as any;
      const inv = one(o?.invoices) as any;
      return row(r.full_refund ? "Storno/Korrektur" : "Rechnungskorrektur", r.credit_note_number, r.credit_note_issued_at, o,
        -Number(r.amount), Number(inv?.vat_rate ?? 0.19), inv?.invoice_number ?? "", r.stripe_refund_id ?? o?.stripe_payment_intent_id ?? "");
    }),
  ].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  downloadCsv(
    ["Belegart", "Belegnummer", "Belegdatum", "Bestellnummer", "Kunde", "Brutto", "Netto", "USt", "USt-Satz", "Bezug (Rechnung)", "Stripe"],
    rows,
    `belege-${month}.csv`,
  );
  return rows.length;
}

function OrderList({ onOpen }: { onOpen: (id: string) => void }) {
  const [params, setParams] = useSearchParams();
  const filters: Filters = { q: params.get("q") ?? "", status: params.get("status") ?? "", page: Math.max(0, Number(params.get("page") ?? 0) || 0) };
  const [search, setSearch] = useState(filters.q);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const update = (patch: Partial<Record<"q" | "status" | "page", string>>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  // Search as you type (debounced); a new search starts on page 1.
  useEffect(() => {
    if (search === filters.q) return;
    const t = setTimeout(() => update({ q: search.trim(), page: "" }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-orders", filters],
    queryFn: () => fetchOrders(filters),
    placeholderData: keepPreviousData,
  });
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  async function runExport(kind: "orders" | "documents") {
    setExportMsg("Export läuft…");
    try {
      if (kind === "orders") { await exportOrdersCsv(filters); setExportMsg(null); }
      else setExportMsg(`${await exportDocumentsCsv(month)} Belege exportiert.`);
    } catch (e) { setExportMsg("Export fehlgeschlagen: " + dbErrorMessage(e)); }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold">Bestellungen</h1>
      <p className="mb-6 text-sm text-muted-foreground">Eingehende Bestellungen verwalten.</p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, E-Mail oder Bestellnummer"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => update({ status: e.target.value, page: "" })}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Alle Status</option>
          <option value="review">⚠ Prüfen nötig</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button onClick={() => runExport("orders")} className="inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent">
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">Bestellungen konnten nicht geladen werden: {dbErrorMessage(error)}</p>
      ) : isLoading ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">{data?.count ?? 0} Bestellungen</p>
          <ul className="divide-y rounded-lg border">
            {data?.rows.map((o) => (
              <li key={o.id}>
                <button onClick={() => onOpen(o.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-accent">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{orderNo(o)}</span>
                      {o.anonymized_at ? <span className="italic text-muted-foreground">anonymisiert</span> : o.customer_name || o.customer_email || "Gast"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(o.created_at)}
                      {Number(o.refunded_amount) > 0 && o.status !== "refunded" && <> · {eur(o.refunded_amount)} erstattet</>}
                    </p>
                  </div>
                  {o.review_reason && o.status !== "cancelled" && o.status !== "refunded" && (
                    <span title={o.review_reason} className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " + (isChargeback(o.review_reason) ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900")}>
                      <AlertTriangle className="h-3 w-3" /> {isChargeback(o.review_reason) ? "Chargeback" : "prüfen"}
                    </span>
                  )}
                  {!o.email_sent && PAID.includes(o.status) && !o.anonymized_at && (
                    <span title="Bestellbestätigung wurde nicht per E-Mail zugestellt"><MailWarning className="h-4 w-4 text-amber-600" /></span>
                  )}
                  <StatusBadge status={o.status} />
                  <span className="w-24 text-right text-sm font-semibold tabular-nums">{eur(Number(o.total))}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            ))}
            {data?.rows.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                {filters.q || filters.status ? "Keine Bestellungen für diesen Filter." : "Noch keine Bestellungen."}
              </li>
            )}
          </ul>
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <button disabled={filters.page === 0} onClick={() => update({ page: String(filters.page - 1) })} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 hover:bg-accent disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> zurück
              </button>
              <span className="text-muted-foreground">Seite {filters.page + 1} von {pages}</span>
              <button disabled={filters.page + 1 >= pages} onClick={() => update({ page: String(filters.page + 1) })} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 hover:bg-accent disabled:opacity-40">
                weiter <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      <div className="mt-8 rounded-xl border p-4 text-sm">
        <p className="font-semibold">Belege für die Buchhaltung</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Alle im Monat erstellten Rechnungen und Rechnungskorrekturen (Erstattungen) mit Netto, USt und Brutto als CSV.
          Die PDFs liegen unveränderlich gespeichert bei der jeweiligen Bestellung.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
          <button disabled={!month} onClick={() => runExport("documents")} className="inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-40">
            <Download className="h-4 w-4" /> Belege (CSV)
          </button>
        </div>
      </div>
      {exportMsg && <p className="mt-2 text-xs text-muted-foreground">{exportMsg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail

function fileSortKey(name: string) {
  const v = VIEW_ORDER.indexOf(name.split("-")[0]);
  return v === -1 ? VIEW_ORDER.length : v;
}

async function fetchOrder(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(`*, order_items(id, qty, unit_price, design_data, design_render_paths, product_name, products(name), variants(colors(name)), sizes(name)),
             invoices(invoice_number, issued_at, emailed_at, pdf_path),
             order_refunds(id, amount, full_refund, reason, created_at, credit_note_number)`)
    .eq("id", id)
    .single();
  if (error) throw error;
  const order: any = data; // items get a runtime `files` list below
  order.invoice = one(order.invoices);
  order.order_refunds = [...(order.order_refunds ?? [])].sort((a: any, b: any) => a.created_at.localeCompare(b.created_at));
  // list + sign every design file for each item (order-designs/<designId>/...);
  // the lines of one designer session (one per size) share a folder
  const folders = new Map<string, Promise<{ files: DesignFile[]; designJsonUrl: string | null }>>();
  for (const it of order.order_items ?? []) {
    const designId = it.design_data?.designId;
    if (designId && !folders.has(designId)) folders.set(designId, signDesignFolder(designId));
    const folder = designId ? await folders.get(designId)! : null;
    it.files = folder?.files ?? [];
    it.designJsonUrl = folder?.designJsonUrl ?? null;
  }
  return order;
}

interface DesignFile { name: string; url: string; downloadUrl: string }

/** Signed view + download URLs for a design folder; design.json only for the ZIP. */
async function signDesignFolder(designId: string) {
  const bucket = supabase.storage.from("order-designs");
  const { data: list } = await bucket.list(designId, { limit: 300 });
  const paths = (list ?? []).map((f) => `${designId}/${f.name}`);
  if (!paths.length) return { files: [], designJsonUrl: null };
  const [view, download] = await Promise.all([
    bucket.createSignedUrls(paths, 3600),
    // Content-Disposition: attachment, so originals (e.g. SVG) are saved, not rendered
    bucket.createSignedUrls(paths, 3600, { download: true }),
  ]);
  const downloadOf = new Map((download.data ?? []).map((d) => [d.path, d.signedUrl]));
  const files: DesignFile[] = [];
  let designJsonUrl: string | null = null;
  for (const d of view.data ?? []) {
    if (!d.path || !d.signedUrl) continue;
    const name = d.path.slice(designId.length + 1);
    if (name === "design.json") designJsonUrl = d.signedUrl;
    else if (!name.endsWith(".json")) files.push({ name, url: d.signedUrl, downloadUrl: downloadOf.get(d.path) ?? d.signedUrl });
  }
  // front, back, left, right — and element-2 before element-10
  files.sort((a, b) => fileSortKey(a.name) - fileSortKey(b.name) || a.name.localeCompare(b.name, "de", { numeric: true }));
  return { files, designJsonUrl };
}

const isPrintFile = (name: string) => name.endsWith("-print.png");
const isOriginal = (name: string) => /-original-\d+\.\w+$/.test(name);

interface PrintSpec {
  view: string;
  file: string | null; // null: order from before print files existed
  cmW?: number;
  cmH?: number;
  dpi?: number;
  zone?: string;
  warnings: string[];
}

const cmText = (n: number) => String(n).replace(".", ",");

/**
 * Print data per designed view from the manifest (order_items.design_data),
 * falling back to design.json's per-view `print` block. Old orders have
 * neither and get file: null.
 */
function printSpecs(designData: any, designJson?: any): PrintSpec[] {
  const manifest: any[] = Array.isArray(designData?.manifest) ? designData.manifest : [];
  const views = new Set<string>([...manifest.map((e) => e?.view), ...Object.keys(designJson ?? {})].filter((v) => typeof v === "string"));
  return [...views].sort((a, b) => fileSortKey(a) - fileSortKey(b)).map((view) => {
    const entries = manifest.filter((e) => e?.view === view);
    const m = entries.find((e) => e?.printFile);
    const p = designJson?.[view]?.print;
    const file = m?.printFile ?? p?.file ?? null;
    const cmW = m?.printCmW ?? p?.cm?.w;
    const cmH = m?.printCmH ?? p?.cm?.h;
    const dpi = m?.printDpi ?? p?.dpi ?? undefined;
    const warnings: string[] = [];
    if (file) {
      if (m?.sizeEstimated ?? p?.sizeEstimated) warnings.push("Maß geschätzt (Druckzone ohne cm-Angabe im Namen) – vor dem Druck prüfen");
      if (typeof dpi === "number" && dpi < MIN_OK_DPI) warnings.push(`Druckdatei nur ${dpi} dpi – wird unscharf`);
      if (m?.clipped ?? p?.clipped) warnings.push("Motiv ragt über die Druckzone hinaus – der Teil außerhalb fehlt in der Druckdatei");
    }
    for (const e of entries) {
      if (typeof e?.dpi === "number" && e.dpi < MIN_OK_DPI) warnings.push(`Bild (Element ${e.index}) nur ca. ${e.dpi} dpi – wird unscharf`);
    }
    return { view, file, cmW, cmH, dpi, zone: m?.zone ?? p?.zone ?? undefined, warnings };
  });
}

/** "30 × 40 cm · 300 dpi · Zone „Brust groß“" */
function printSpecText(s: PrintSpec) {
  return [
    s.cmW && s.cmH ? `${cmText(s.cmW)} × ${cmText(s.cmH)} cm` : "Maß unbekannt",
    s.dpi ? `${s.dpi} dpi` : null,
    s.zone ? `Zone „${s.zone}“` : "ohne Druckzone",
  ].filter(Boolean).join(" · ");
}

/** Folder name of an order line in the production ZIP. */
const itemFolder = (it: any) =>
  `${it.product_name ?? it.products?.name ?? "artikel"}_${it.variants?.colors?.name ?? ""}_${it.sizes?.name ?? ""}_${it.qty}x`.replace(/[^\w-]+/g, "-");

function FileRow({ title, files, manifest }: { title: string; files: any[]; manifest?: any[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {files.map((f) => {
          // pair by file name: the designer uploads <view>-element-<index>.png
          const m = manifest?.find((e) => `${e?.view}-element-${e?.index}.png` === f.name);
          return (
            <a
              key={f.name}
              href={f.downloadUrl ?? f.url}
              download={f.name}
              target="_blank"
              rel="noreferrer"
              className="group relative"
              title={(m?.text ? `"${m.text}"` : f.name) + " — herunterladen"}
            >
              <img loading="lazy" decoding="async" src={f.url} alt="" className="h-16 w-16 rounded border bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px] object-contain" />
              <span className="absolute inset-0 flex items-center justify-center rounded bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                <Download className="h-5 w-5 text-white" />
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/** Print files (<view>-print.png) with size, DPI and zone from the manifest. */
function PrintFiles({ files, specs }: { files: any[]; specs: PrintSpec[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Druckdatei{files.length > 1 ? "en" : ""}</p>
      <div className="flex flex-wrap gap-3">
        {files.map((f) => {
          const spec = specs.find((s) => s.file === f.name);
          const view = f.name.replace(/-print\.png$/, "");
          return (
            <div key={f.name} className="flex gap-3 rounded-lg border bg-background p-2">
              <a href={f.url} target="_blank" rel="noreferrer" title={`${f.name} ansehen`}>
                <img loading="lazy" decoding="async" src={f.url} alt="" className="h-20 w-20 rounded border bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px] object-contain" />
              </a>
              <div className="min-w-0 max-w-xs text-xs">
                <p className="font-medium">Druckdatei {VIEW_LABEL[view] ?? view}</p>
                <p className="font-mono text-muted-foreground">{f.name}</p>
                <p className="text-muted-foreground">{spec ? printSpecText(spec) : "Maß nicht im Manifest"}</p>
                {spec?.warnings.map((w) => <p key={w} className="text-amber-800">⚠ {w}</p>)}
                <a href={f.downloadUrl ?? f.url} download={f.name} className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
                  <Download className="h-3.5 w-3.5" /> herunterladen
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Review flag from checkout or a chargeback, unsent confirmation, anonymisation. */
function Notices({ order, onChange }: { order: any; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const active = order.status !== "cancelled" && order.status !== "refunded";

  async function resolveReview() {
    setBusy(true); setErr(null);
    // keep the reason in the internal note as a small audit trail
    const line = `[${fmtDay(new Date().toISOString())}] Prüfhinweis erledigt: ${order.review_reason}`;
    const { error } = await supabase.from("orders").update({
      review_reason: null,
      internal_note: order.internal_note ? `${order.internal_note}\n${line}` : line,
    }).eq("id", order.id);
    if (error) setErr(dbErrorMessage(error));
    setBusy(false); onChange();
  }

  return (
    <div className="mt-4 space-y-2 text-sm">
      {order.review_reason && active && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{isChargeback(order.review_reason) ? "Zahlung angefochten – bitte prüfen" : "Bitte prüfen, bevor produziert wird"}</p>
            <p>{order.review_reason}</p>
            {err && <p className="mt-1 text-destructive">{err}</p>}
          </div>
          <button onClick={resolveReview} disabled={busy} className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium hover:bg-amber-100 disabled:opacity-60">
            erledigt
          </button>
        </div>
      )}
      {!order.email_sent && PAID.includes(order.status) && order.customer_email && !order.anonymized_at && (
        <div className="flex items-start gap-3 rounded-lg border p-3 text-muted-foreground">
          <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            Die Bestellbestätigung wurde nicht per E-Mail zugestellt (E-Mail-Versand nicht eingerichtet oder abgelehnt).
            Bitte den Kunden ggf. selbst informieren – z. B. mit „Rechnung per E-Mail senden“.
          </p>
        </div>
      )}
      {order.anonymized_at && (
        <div className="flex items-start gap-3 rounded-lg border p-3 text-muted-foreground">
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Die Kundendaten dieser Bestellung wurden am {fmtDate(order.anonymized_at)} anonymisiert.</p>
        </div>
      )}
    </div>
  );
}

/** Tracking number, mark as shipped (+ mail, optional invoice attachment). */
function FulfillmentCard({ order, onChange }: { order: any; onChange: () => void }) {
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [attachInvoice, setAttachInvoice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canShip = order.status === "paid" || order.status === "in_production";
  const shipped = order.status === "shipped";

  async function ship(resend: boolean) {
    if (resend && order.ship_email_sent_at && !confirm(`Die Versandmail wurde am ${fmtDate(order.ship_email_sent_at)} schon gesendet. Erneut senden?`)) return;
    setBusy(true); setMsg(null);
    const { data, error } = await invokeFn("send-ship-email", { orderId: order.id, trackingNumber: tracking, resend, attachInvoice });
    if (error) setMsg("Fehler: " + error);
    else {
      const parts = [canShip ? "Als versendet markiert." : "Gespeichert."];
      if (data?.mailed) parts.push(`Versandmail an den Kunden gesendet${data.invoiceNumber ? ` (mit Rechnung ${data.invoiceNumber})` : ""}.`);
      else if (data?.alreadySent) parts.push(`Versandmail wurde bereits am ${fmtDate(data.alreadySent)} gesendet.`);
      else if (data?.skipped === "no customer email") parts.push("Keine Mail: keine Kunden-E-Mail hinterlegt.");
      else if (data?.skipped === "not configured") parts.push("Keine Mail: E-Mail-Versand ist nicht eingerichtet.");
      else parts.push("Mail fehlgeschlagen: der E-Mail-Dienst hat sie abgelehnt.");
      if (data?.invoiceError) parts.push(`Rechnung konnte nicht angehängt werden: ${data.invoiceError}`);
      setMsg(parts.join(" "));
    }
    setBusy(false); onChange();
  }

  async function saveTracking() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("orders").update({ tracking_number: tracking.trim() || null }).eq("id", order.id);
    setMsg(error ? "Fehler: " + dbErrorMessage(error) : "Sendungsnummer gespeichert.");
    setBusy(false); onChange();
  }

  return (
    <div className="mt-6 rounded-xl border p-4 text-sm">
      <p className="mb-3 flex items-center gap-2 font-semibold"><Truck className="h-4 w-4" /> Versand</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Sendungsnummer</label>
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="z. B. DHL 00340…" maxLength={100}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <button onClick={saveTracking} disabled={busy || !!order.anonymized_at} className="h-10 rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-60">speichern</button>
        {canShip && (
          <button onClick={() => ship(false)} disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
            als versendet markieren + Mail
          </button>
        )}
        {shipped && (
          <button onClick={() => ship(true)} disabled={busy || !order.customer_email} className="h-10 rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-60">
            Versandmail {order.ship_email_sent_at ? "erneut " : ""}senden
          </button>
        )}
      </div>
      {(canShip || shipped) && (
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={attachInvoice} onChange={(e) => setAttachInvoice(e.target.checked)} />
          Rechnung als PDF anhängen{order.invoice ? ` (${order.invoice.invoice_number})` : " (wird dabei erstellt – mit dem Versanddatum als Lieferdatum)"}
        </label>
      )}
      {!canShip && !shipped && (
        <p className="mt-2 text-xs text-muted-foreground">Versand ist nur für bezahlte Bestellungen möglich.</p>
      )}
      {order.shipped_at && (
        <p className="mt-2 text-xs text-muted-foreground">
          Versendet am {fmtDate(order.shipped_at)}
          {order.ship_email_sent_at ? ` · Versandmail gesendet am ${fmtDate(order.ship_email_sent_at)}` : " · Versandmail noch nicht zugestellt"}
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

/** Production ZIP, invoice PDF, invoice by mail. */
function DocumentsCard({ order, onChange }: { order: any; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const inv = order.invoice;
  const invoiceable = !!inv || (!order.anonymized_at &&
    (PAID.includes(order.status) || (order.status === "refunded" && (order.order_refunds ?? []).length > 0)));

  async function downloadZip() {
    setBusy("zip"); setMsg(null);
    try {
      const zip = new JSZip();
      let n = 0;
      const lines: string[] = [];
      for (const it of order.order_items ?? []) {
        const label = itemFolder(it);
        for (const f of it.files ?? []) {
          const res = await fetch(f.url);
          if (!res.ok) continue;
          zip.file(`${label}/${f.name}`, await res.blob());
          n++;
        }
        // design.json: the editable design and, per view, the print block (fallback for print data)
        let designJson: any = null;
        if (it.designJsonUrl) {
          const res = await fetch(it.designJsonUrl);
          if (res.ok) {
            const text = await res.text();
            zip.file(`${label}/design.json`, text);
            n++;
            try { designJson = JSON.parse(text); } catch { /* keep the file, skip the fallback */ }
          }
        }
        lines.push(`${it.qty}× ${it.product_name ?? it.products?.name} — ${it.variants?.colors?.name} / ${it.sizes?.name}`);
        if (!it.design_data?.designId) { lines.push("   ohne Design", ""); continue; }
        lines.push(`   Ordner: ${label}/`);
        for (const spec of printSpecs(it.design_data, designJson)) {
          const view = VIEW_LABEL[spec.view] ?? spec.view;
          lines.push(spec.file
            ? `   ${view}: ${spec.file} · ${printSpecText(spec)}`
            : `   ${view}: keine Druckdatei (ältere Bestellung) – ${spec.view}-design.png verwenden, Maß selbst festlegen`);
          for (const w of spec.warnings) lines.push(`      ACHTUNG: ${w}`);
        }
        lines.push("");
      }
      if (n === 0) { setMsg("Keine Design-Dateien in dieser Bestellung."); setBusy(null); return; }
      zip.file("PRODUKTION.txt", `Bestellung ${orderNo(order)}\nKunde: ${order.customer_name ?? "—"}\n\n${lines.join("\n")}`);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `bestellung-${orderNo(order)}-designs.zip`; a.click();
      URL.revokeObjectURL(url);
      setMsg(`${n} Dateien als ZIP geladen.`);
    } catch (e) { setMsg("ZIP-Fehler: " + (e as Error).message); }
    setBusy(null);
  }

  async function invoice() {
    setBusy("pdf"); setMsg(null);
    const { data, error } = await invokeFn("generate-invoice", { orderId: order.id });
    if (error) setMsg("Rechnung fehlgeschlagen: " + error);
    else if (data?.pdfBase64) {
      downloadPdf(data.pdfBase64, data.filename ?? `Rechnung-${data.number}.pdf`);
      setMsg(inv ? `Rechnung ${data.number} geladen.` : `Rechnung ${data.number} erstellt und gespeichert.`);
    } else setMsg("Keine PDF erhalten.");
    setBusy(null); onChange();
  }

  async function sendInvoice() {
    if (!confirm(`Rechnung${inv ? " " + inv.invoice_number : ""} per E-Mail an ${order.customer_email} senden?`)) return;
    setBusy("mail"); setMsg(null);
    const { data, error } = await invokeFn("send-invoice", { orderId: order.id });
    setMsg(error ? "Senden fehlgeschlagen: " + error : `Rechnung ${data?.invoiceNumber} an ${order.customer_email} gesendet.`);
    setBusy(null); onChange();
  }

  return (
    <div className="mt-4 rounded-xl border p-4 text-sm">
      <p className="mb-3 font-semibold">Dokumente</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={downloadZip} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60">
          <Package className="h-4 w-4" /> {busy === "zip" ? "packe…" : "Design-Dateien (ZIP)"}
        </button>
        <button onClick={invoice} disabled={!!busy || !invoiceable} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60">
          <FileText className="h-4 w-4" /> {busy === "pdf" ? "erstelle…" : inv ? "Rechnung (PDF)" : "Rechnung erstellen (PDF)"}
        </button>
        <button onClick={sendInvoice} disabled={!!busy || !invoiceable || !order.customer_email} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60">
          <Mail className="h-4 w-4" /> {busy === "mail" ? "sende…" : "Rechnung per E-Mail senden"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {inv
          ? <>Rechnung {inv.invoice_number} vom {fmtDay(inv.issued_at)}{inv.emailed_at ? ` · per E-Mail gesendet am ${fmtDate(inv.emailed_at)}` : " · noch nicht per E-Mail gesendet"}. Die Rechnung ist gespeichert und bleibt unverändert.</>
          : order.shipped_at
            ? "Noch keine Rechnung erstellt."
            : "Noch keine Rechnung. Tipp: erst beim Versand erstellen (Häkchen bei „Versand“) – dann steht das genaue Lieferdatum darauf. Eine erstellte Rechnung lässt sich nicht mehr ändern."}
      </p>
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

/** Full / partial Stripe refunds with their correction invoices. */
function RefundCard({ order, onChange }: { order: any; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [partialOpen, setPartialOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  // One request id per refund attempt: a retry after an error reuses it, so
  // Stripe and the DB act only once even if the first answer got lost.
  const pending = useRef<{ key: string; id: string } | null>(null);

  const total = Number(order.total ?? 0);
  const refundedSoFar = Number(order.refunded_amount ?? 0);
  const remaining = round2(total - refundedSoFar);
  const refunds: any[] = order.order_refunds ?? [];
  const canRefund = PAID.includes(order.status) && remaining > 0 && !!order.stripe_payment_intent_id;

  async function refund(kind: "full" | "partial") {
    const value = kind === "full" ? remaining : round2(Number(amount.replace(",", ".")));
    if (kind === "partial") {
      if (!(value > 0) || value > remaining) { setMsg(`Bitte einen Betrag zwischen 0,01 € und ${eur(remaining)} eingeben.`); return; }
      if (reason.trim().length < 3) { setMsg("Bitte einen Grund angeben – er steht auf der Rechnungskorrektur."); return; }
    }
    const question = kind === "full"
      ? `${eur(remaining)} über Stripe erstatten? Die Bestellung wird auf „erstattet“ gesetzt${order.status === "paid" ? ", der Bestand zurückgebucht" : ""} und eine Stornorechnung erstellt.`
      : `${eur(value)} über Stripe erstatten? Status und Bestand bleiben unverändert; es wird eine Rechnungskorrektur erstellt.`;
    if (!confirm(question)) return;

    const key = `${kind}:${value}`;
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    setBusy(kind); setMsg(null);
    const { data, error } = await invokeFn("refund-order", {
      orderId: order.id,
      requestId: pending.current.id,
      ...(kind === "partial" ? { amount: value, reason: reason.trim() } : {}),
    });
    if (error) setMsg("Erstattung fehlgeschlagen: " + error);
    else {
      pending.current = null;
      setPartialOpen(false); setAmount(""); setReason("");
      setMsg(`${eur(data?.refunded ?? value)} erstattet.${data?.creditNote ? ` ${data.full ? "Storno-/Korrekturrechnung" : "Rechnungskorrektur"} ${data.creditNote} erstellt.` : ""}${data?.documentError ? " " + data.documentError : ""}`);
    }
    setBusy(null); onChange();
  }

  async function creditNotePdf(refundId: string) {
    setBusy(refundId); setMsg(null);
    const { data, error } = await invokeFn("generate-invoice", { orderId: order.id, refundId });
    if (error) setMsg("PDF fehlgeschlagen: " + error);
    else if (data?.pdfBase64) downloadPdf(data.pdfBase64, data.filename ?? `${data.number}.pdf`);
    setBusy(null); onChange();
  }

  return (
    <div className="mt-4 rounded-xl border p-4 text-sm">
      <p className="mb-1 font-semibold">Rückerstattung</p>
      <p className="text-xs text-muted-foreground">
        Bezahlt {eur(total)}{refundedSoFar > 0 && <> · bereits erstattet {eur(refundedSoFar)} · offen {eur(Math.max(0, remaining))}</>}
      </p>

      {refunds.length > 0 && (
        <ul className="mt-3 divide-y rounded-lg border">
          {refunds.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{eur(r.amount)} · {r.full_refund ? "vollständig / Rest" : "teilweise"}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(r.created_at)}{r.reason ? ` · ${r.reason}` : ""}</p>
              </div>
              <button onClick={() => creditNotePdf(r.id)} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-60">
                <FileText className="h-3.5 w-3.5" /> {busy === r.id ? "lade…" : r.credit_note_number ?? "Korrektur erstellen"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {canRefund ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => refund("full")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60">
              <Undo2 className="h-4 w-4" /> {busy === "full" ? "erstatte…" : refundedSoFar > 0 ? `Rest erstatten (${eur(remaining)})` : "Vollständig erstatten / stornieren"}
            </button>
            <button onClick={() => setPartialOpen((v) => !v)} disabled={!!busy} className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60">
              Teilerstattung…
            </button>
          </div>
          {partialOpen && (
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-3">
              <div className="w-32 space-y-1">
                <label className="text-xs text-muted-foreground">Betrag (€)</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="z. B. 12,50"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <div className="min-w-[200px] flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Grund (steht auf der Rechnungskorrektur)</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="z. B. Fehldruck auf 1 Shirt"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <button onClick={() => refund("partial")} disabled={!!busy} className="h-10 rounded-md border border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60">
                {busy === "partial" ? "erstatte…" : "erstatten"}
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Erstattungen laufen über Stripe auf das Zahlungsmittel des Kunden. Jede Erstattung erhält eine eigene Rechnungskorrektur (RK-…); die ursprüngliche Rechnung bleibt unverändert.
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {order.status === "refunded" ? "Vollständig erstattet."
            : !PAID.includes(order.status) ? "Nur bezahlte Bestellungen können erstattet werden."
            : !order.stripe_payment_intent_id ? "Keine Online-Zahlung – bitte manuell erstatten."
            : "Nichts mehr offen."}
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

/** Admin-only notes (orders are not readable by customers). */
function NoteCard({ order, onChange }: { order: any; onChange: () => void }) {
  const [note, setNote] = useState(order.internal_note ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setNote(order.internal_note ?? ""), [order.internal_note]);
  const dirty = note !== (order.internal_note ?? "");

  async function save() {
    const { error } = await supabase.from("orders").update({ internal_note: note.trim() || null }).eq("id", order.id);
    setMsg(error ? "Fehler: " + dbErrorMessage(error) : "Notiz gespeichert.");
    onChange();
  }

  return (
    <div className="mt-4 rounded-xl border p-4 text-sm">
      <p className="mb-2 flex items-center gap-2 font-semibold"><StickyNote className="h-4 w-4" /> Interne Notiz</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder="Nur für das Team sichtbar, z. B. Druckhinweise oder Absprachen mit dem Kunden"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div className="mt-2 flex items-center gap-3">
        <button onClick={save} disabled={!dirty} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50">speichern</button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

/** DSGVO Art. 17 erasure that keeps the accounting records. */
function PrivacyCard({ order, onChange }: { order: any; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inProgress = order.status === "paid" || order.status === "in_production";

  async function anonymize() {
    if (!confirm("Name, E-Mail, Adresse, Sendungsnummer, interne Notiz und Design-Dateien dieser Bestellung werden endgültig gelöscht. Beträge und bereits erstellte Rechnungen bleiben erhalten. Fortfahren?")) return;
    setBusy(true); setMsg(null);
    const { data, error } = await invokeFn("anonymize-order", { orderId: order.id });
    setMsg(error ? "Fehler: " + error : `Kundendaten anonymisiert${data?.filesRemoved ? `, ${data.filesRemoved} Design-Dateien gelöscht` : ""}.`);
    setBusy(false); onChange();
  }

  return (
    <div className="mt-6 rounded-xl border p-4 text-sm">
      <p className="mb-1 flex items-center gap-2 font-semibold"><ShieldOff className="h-4 w-4" /> Datenschutz</p>
      <p className="text-xs text-muted-foreground">
        Auf Wunsch des Kunden (Löschung nach Art. 17 DSGVO) werden Name, E-Mail, Adresse, Sendungsnummer, interne Notiz und die
        hochgeladenen Design-Dateien entfernt. Beträge und Positionen bleiben für die Buchhaltung. Bereits erstellte Rechnungen und
        Rechnungskorrekturen bleiben unverändert gespeichert, weil sie als Buchungsbelege aufbewahrt werden müssen (§ 147 AO, § 14b UStG –
        derzeit 8 Jahre). Daten bei Stripe und in E-Mail-Postfächern bitte separat löschen. Nicht möglich, solange die Bestellung bearbeitet
        wird (bezahlt oder in Produktion); offene, versendete, abgeschlossene, erstattete und stornierte Bestellungen lassen sich anonymisieren –
        bei versendeten am besten erst nach Ablauf möglicher Reklamationen.
      </p>
      <button
        onClick={anonymize}
        disabled={busy || inProgress || !!order.anonymized_at}
        className="mt-3 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
      >
        {order.anonymized_at ? "bereits anonymisiert" : busy ? "anonymisiere…" : "Kundendaten anonymisieren"}
      </button>
      {inProgress && !order.anonymized_at && (
        <p className="mt-2 text-xs text-muted-foreground">Die Bestellung wird gerade bearbeitet – anonymisieren geht erst, wenn sie versendet, abgeschlossen oder erstattet ist.</p>
      )}
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

function OrderDetail({ order, onBack, onChange }: { order: any; onBack: () => void; onChange: () => void }) {
  const qc = useQueryClient();
  const next = NEXT_STATUS[order.status] ?? [];
  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
      if (error) throw error;
    },
    onSettled: () => {
      onChange();
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  return (
    <div className="max-w-3xl">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ChevronLeft className="h-4 w-4" /> Alle Bestellungen
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bestellung {orderNo(order)}</h1>
          <p className="font-mono text-xs text-muted-foreground">{order.id}</p>
          <p className="mt-1 text-sm text-muted-foreground">{fmtDate(order.created_at)}</p>
        </div>
        <div className="text-right">
          {next.length > 0 ? (
            <select
              value={order.status}
              disabled={setStatus.isPending}
              onChange={(e) => {
                const s = e.target.value;
                if (s === "cancelled" && !confirm("Diese unbezahlte Bestellung stornieren?")) return;
                if (order.status === "pending" && s === "paid" && !confirm("Als bezahlt markieren? Nur wählen, wenn die Zahlung tatsächlich eingegangen ist.")) return;
                setStatus.mutate(s);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={order.status}>{STATUS_LABEL[order.status] ?? order.status}</option>
              {next.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          ) : (
            <StatusBadge status={order.status} />
          )}
          {PAID.includes(order.status) && (
            <p className="mt-1 text-xs text-muted-foreground">Erstatten / stornieren: unten bei „Rückerstattung“</p>
          )}
          {setStatus.error && <p className="mt-1 max-w-xs text-xs text-destructive">{dbErrorMessage(setStatus.error)}</p>}
        </div>
      </div>

      <Notices order={order} onChange={onChange} />

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border p-4 text-sm">
          <p className="mb-2 font-semibold">Kunde</p>
          {order.anonymized_at ? (
            <p className="italic text-muted-foreground">anonymisiert</p>
          ) : (
            <>
              <p>{order.customer_name || "—"}</p>
              <p className="text-muted-foreground">{order.customer_email}</p>
              {order.customer_address && (
                <p className="mt-1 text-muted-foreground">
                  {order.customer_address.line1}, {order.customer_address.postal_code} {order.customer_address.city}
                  {order.customer_address.country && order.customer_address.country !== "DE" ? `, ${order.customer_address.country}` : ""}
                </p>
              )}
            </>
          )}
        </div>
        <div className="rounded-xl border p-4 text-sm">
          <p className="mb-2 font-semibold">Zahlung</p>
          <p className="text-muted-foreground">Stripe: {order.stripe_payment_intent_id || "—"}</p>
          {order.coupon_code && <p className="text-muted-foreground">Gutschein {order.coupon_code} (−{eur(order.discount_amount)})</p>}
          <p className="mt-1 text-lg font-bold text-primary">{eur(Number(order.total))}</p>
          {Number(order.refunded_amount) > 0 && <p className="text-xs text-rose-700">davon erstattet {eur(order.refunded_amount)}</p>}
        </div>
      </div>

      <FulfillmentCard key={`ship-${order.id}`} order={order} onChange={onChange} />
      <DocumentsCard order={order} onChange={onChange} />
      <RefundCard order={order} onChange={onChange} />
      <NoteCard key={`note-${order.id}`} order={order} onChange={onChange} />

      <p className="mb-2 mt-6 font-semibold">Positionen</p>
      <ul className="divide-y rounded-xl border">
        {order.order_items?.map((it: any) => {
          const composites = (it.files ?? []).filter((f: any) => f.name.includes("composite"));
          const prints = (it.files ?? []).filter((f: any) => isPrintFile(f.name));
          const originals = (it.files ?? []).filter((f: any) => isOriginal(f.name));
          const designs = (it.files ?? []).filter((f: any) => f.name.includes("-design.png"));
          const elements = (it.files ?? []).filter((f: any) => f.name.includes("element"));
          return (
            <li key={it.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  {composites.length > 0 ? (
                    composites.map((f: any) => (
                      <a key={f.name} href={f.url} target="_blank" rel="noreferrer">
                        <img loading="lazy" decoding="async" src={f.url} alt="" className="h-16 w-16 rounded border object-contain bg-white" />
                      </a>
                    ))
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded border bg-muted text-[10px] text-muted-foreground">kein Design</div>
                  )}
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium">{it.product_name ?? it.products?.name ?? "—"}</p>
                  <p className="text-muted-foreground">{it.variants?.colors?.name} · {it.sizes?.name} · {it.qty}×</p>
                </div>
                <span className="text-sm tabular-nums">{eur((Number(it.unit_price) * it.qty))}</span>
              </div>

              {(it.files ?? []).length > 0 && (
                <div className="mt-3 space-y-3 rounded-lg bg-muted/40 p-3">
                  {prints.length > 0 && <PrintFiles files={prints} specs={printSpecs(it.design_data)} />}
                  {originals.length > 0 && (
                    <FileRow title={`Original-Uploads des Kunden (${originals.length})`} files={originals} />
                  )}
                  {designs.length > 0 && (
                    <FileRow title="Motiv (transparent)" files={designs} />
                  )}
                  {elements.length > 0 && (
                    <FileRow title={`Einzel-Elemente (${elements.length})`} files={elements} manifest={it.design_data?.manifest} />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <PrivacyCard order={order} onChange={onChange} />
    </div>
  );
}

export default function Orders() {
  const qc = useQueryClient();
  // The open order lives in the URL (?id=…) so reload, back button and links
  // work; list filters (q, status, page) stay in the URL next to it.
  const [params, setParams] = useSearchParams();
  const openId = params.get("id");
  const setOpenId = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("id", id); else next.delete("id");
    setParams(next);
  };
  const { data: order, error } = useQuery({ queryKey: ["admin-order", openId], queryFn: () => fetchOrder(openId!), enabled: !!openId });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-order", openId] });
  };

  if (openId) {
    if (error) {
      return (
        <div className="max-w-3xl">
          <button onClick={() => setOpenId(null)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ChevronLeft className="h-4 w-4" /> Alle Bestellungen
          </button>
          <p className="text-sm text-destructive">Bestellung konnte nicht geladen werden: {dbErrorMessage(error)}</p>
        </div>
      );
    }
    if (!order) return <p className="text-muted-foreground">Lade…</p>;
    return <OrderDetail order={order} onBack={() => setOpenId(null)} onChange={refresh} />;
  }
  return <OrderList onOpen={setOpenId} />;
}
