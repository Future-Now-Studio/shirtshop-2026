import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Download, FileText, Package, Undo2 } from "lucide-react";
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";

function FileRow({ title, files, manifest }: { title: string; files: any[]; manifest?: any[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => {
          const m = manifest?.[i];
          return (
            <a
              key={f.name}
              href={f.url}
              download={f.name}
              target="_blank"
              rel="noreferrer"
              className="group relative"
              title={(m?.text ? `"${m.text}"` : f.name) + " — herunterladen"}
            >
              <img src={f.url} alt="" className="h-16 w-16 rounded border bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px] object-contain" />
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

function fmtDate(s: string) {
  return new Date(s).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

/** F1: fulfillment — tracking number + shipped mail. */
function FulfillmentCard({ order, onChange }: { order: any; onChange: () => void }) {
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function markShipped() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("orders").update({
      status: "shipped", tracking_number: tracking || null, shipped_at: new Date().toISOString(),
    }).eq("id", order.id);
    if (error) { setMsg("Fehler: " + error.message); setBusy(false); return; }
    // send shipping mail (best effort — needs send-ship-email function deployed)
    try {
      await supabase.functions.invoke("send-ship-email", { body: { orderId: order.id } });
      setMsg("Als versendet markiert · Mail ausgelöst.");
    } catch { setMsg("Als versendet markiert (Mail-Funktion nicht erreichbar)."); }
    setBusy(false); onChange();
  }

  async function saveTracking() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("orders").update({ tracking_number: tracking || null }).eq("id", order.id);
    setMsg(error ? "Fehler: " + error.message : "Sendungsnummer gespeichert.");
    setBusy(false); onChange();
  }

  return (
    <div className="mt-6 rounded-xl border p-4 text-sm">
      <p className="mb-3 font-semibold">Versand</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Sendungsnummer</label>
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="z. B. DHL 00340…"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <button onClick={saveTracking} disabled={busy} className="h-10 rounded-md border px-3 text-sm hover:bg-accent">speichern</button>
        <button onClick={markShipped} disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
          als versendet markieren + mail
        </button>
      </div>
      {order.shipped_at && <p className="mt-2 text-xs text-muted-foreground">Versendet am {fmtDate(order.shipped_at)}</p>}
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

async function fetchOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, status, customer_name, customer_email, total")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function fetchOrder(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(`*, order_items(id, qty, unit_price, design_render_paths, products(name), variants(colors(name)), sizes(name))`)
    .eq("id", id)
    .single();
  if (error) throw error;
  // list + sign every design file for each item (order-designs/<designId>/...)
  for (const it of data.order_items ?? []) {
    it.files = [];
    const designId = it.design_data?.designId;
    if (designId) {
      const { data: list } = await supabase.storage.from("order-designs").list(designId, { limit: 300 });
      for (const f of list ?? []) {
        if (f.name.endsWith(".json")) continue;
        const { data: signed } = await supabase.storage
          .from("order-designs")
          .createSignedUrl(`${designId}/${f.name}`, 3600);
        if (signed?.signedUrl) it.files.push({ name: f.name, url: signed.signedUrl });
      }
      it.files.sort((a: any, b: any) => a.name.localeCompare(b.name));
    }
  }
  return data;
}

/** F2 + F3 + F4: production ZIP, invoice PDF, refund. */
function OrderActions({ order, onChange }: { order: any; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function downloadZip() {
    setBusy("zip"); setMsg(null);
    try {
      const zip = new JSZip();
      let n = 0;
      for (const it of order.order_items ?? []) {
        const label = `${it.products?.name ?? "artikel"}_${it.variants?.colors?.name ?? ""}_${it.sizes?.name ?? ""}_${it.qty}x`.replace(/[^\w-]+/g, "-");
        for (const f of it.files ?? []) {
          const res = await fetch(f.url);
          if (!res.ok) continue;
          zip.file(`${label}/${f.name}`, await res.blob());
          n++;
        }
      }
      if (n === 0) { setMsg("Keine Design-Dateien in dieser Bestellung."); setBusy(null); return; }
      const specs = (order.order_items ?? []).map((it: any) =>
        `${it.qty}× ${it.products?.name} — ${it.variants?.colors?.name} / ${it.sizes?.name}`).join("\n");
      zip.file("PRODUKTION.txt", `Bestellung ${order.id}\nKunde: ${order.customer_name}\n\n${specs}\n`);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `bestellung-${order.id.slice(0, 8)}-designs.zip`; a.click();
      URL.revokeObjectURL(url);
      setMsg(`${n} Dateien als ZIP geladen.`);
    } catch (e) { setMsg("ZIP-Fehler: " + (e as Error).message); }
    setBusy(null);
  }

  async function invoice() {
    setBusy("pdf"); setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoice", { body: { orderId: order.id } });
      if (error || data?.error) throw new Error(error?.message ?? data.error);
      if (data?.pdfBase64) {
        const a = document.createElement("a");
        a.href = `data:application/pdf;base64,${data.pdfBase64}`;
        a.download = `rechnung-${order.id.slice(0, 8)}.pdf`; a.click();
        setMsg("Rechnung erstellt.");
      } else setMsg("Keine PDF erhalten.");
    } catch (e) { setMsg("PDF-Funktion nicht erreichbar (deployen): " + (e as Error).message); }
    setBusy(null);
  }

  async function refund() {
    if (!confirm("Diese Bestellung wirklich vollständig über Stripe erstatten? Bestand wird zurückgebucht.")) return;
    setBusy("refund"); setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("refund-order", { body: { orderId: order.id } });
      if (error || data?.error) throw new Error(error?.message ?? data.error);
      setMsg("Erstattet.");
      onChange();
    } catch (e) { setMsg("Refund-Funktion nicht erreichbar (deployen): " + (e as Error).message); }
    setBusy(null);
  }

  const refunded = order.status === "refunded";
  return (
    <div className="mt-4 rounded-xl border p-4">
      <p className="mb-3 text-sm font-semibold">Aktionen</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={downloadZip} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60">
          <Package className="h-4 w-4" /> {busy === "zip" ? "packe…" : "Design-Dateien (ZIP)"}
        </button>
        <button onClick={invoice} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60">
          <FileText className="h-4 w-4" /> {busy === "pdf" ? "erstelle…" : "Rechnung (PDF)"}
        </button>
        <button onClick={refund} disabled={!!busy || refunded} className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60">
          <Undo2 className="h-4 w-4" /> {refunded ? "erstattet" : busy === "refund" ? "erstatte…" : "Rückerstattung"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

export default function Orders() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: orders, isLoading } = useQuery({ queryKey: ["admin-orders"], queryFn: fetchOrders });
  const { data: order } = useQuery({ queryKey: ["admin-order", openId], queryFn: () => fetchOrder(openId!), enabled: !!openId });

  const setStatus = useMutation({
    mutationFn: async (p: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: p.status }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-order", openId] });
    },
  });

  if (openId && order) {
    return (
      <div className="max-w-3xl">
        <button onClick={() => setOpenId(null)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft className="h-4 w-4" /> Alle Bestellungen
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Bestellung</h1>
            <p className="font-mono text-xs text-muted-foreground">{order.id}</p>
            <p className="mt-1 text-sm text-muted-foreground">{fmtDate(order.created_at)}</p>
          </div>
          <select
            value={order.status}
            onChange={(e) => setStatus.mutate({ id: order.id, status: e.target.value })}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border p-4 text-sm">
            <p className="mb-2 font-semibold">Kunde</p>
            <p>{order.customer_name || "—"}</p>
            <p className="text-muted-foreground">{order.customer_email}</p>
            {order.customer_address && (
              <p className="mt-1 text-muted-foreground">
                {order.customer_address.line1}, {order.customer_address.postal_code} {order.customer_address.city}
              </p>
            )}
          </div>
          <div className="rounded-xl border p-4 text-sm">
            <p className="mb-2 font-semibold">Zahlung</p>
            <p className="text-muted-foreground">Stripe PI: {order.stripe_payment_intent_id || "—"}</p>
            <p className="mt-1 text-lg font-bold text-primary">{Number(order.total).toFixed(2)} €</p>
          </div>
        </div>

        <FulfillmentCard order={order} onChange={() => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); qc.invalidateQueries({ queryKey: ["admin-order", openId] }); }} />

        <OrderActions order={order} onChange={() => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); qc.invalidateQueries({ queryKey: ["admin-order", openId] }); }} />

        <p className="mb-2 mt-6 font-semibold">Positionen</p>
        <ul className="divide-y rounded-xl border">
          {order.order_items?.map((it: any) => {
            const composites = (it.files ?? []).filter((f: any) => f.name.includes("composite"));
            const designs = (it.files ?? []).filter((f: any) => f.name.includes("-design.png"));
            const elements = (it.files ?? []).filter((f: any) => f.name.includes("element"));
            return (
              <li key={it.id} className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5">
                    {composites.length > 0 ? (
                      composites.map((f: any) => (
                        <a key={f.name} href={f.url} target="_blank" rel="noreferrer">
                          <img src={f.url} alt="" className="h-16 w-16 rounded border object-contain bg-white" />
                        </a>
                      ))
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded border bg-muted text-[10px] text-muted-foreground">kein Design</div>
                    )}
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{it.products?.name ?? "—"}</p>
                    <p className="text-muted-foreground">{it.variants?.colors?.name} · {it.sizes?.name} · {it.qty}×</p>
                  </div>
                  <span className="text-sm tabular-nums">{(Number(it.unit_price) * it.qty).toFixed(2)} €</span>
                </div>

                {(it.files ?? []).length > 0 && (
                  <div className="mt-3 space-y-3 rounded-lg bg-muted/40 p-3">
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
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Bestellungen</h1>
      <p className="mb-6 text-sm text-muted-foreground">Eingehende Bestellungen verwalten.</p>

      {isLoading ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {orders?.map((o) => (
            <li key={o.id}>
              <button onClick={() => setOpenId(o.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-accent">
                <div className="flex-1">
                  <p className="font-medium">{o.customer_name || o.customer_email || "Gast"}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p>
                </div>
                <span className={"rounded-full px-2.5 py-0.5 text-xs font-medium " + (STATUS_CLS[o.status] ?? "")}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                <span className="w-20 text-right text-sm font-semibold tabular-nums">{Number(o.total).toFixed(2)} €</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
          {orders?.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">Noch keine Bestellungen.</li>}
        </ul>
      )}
    </div>
  );
}
