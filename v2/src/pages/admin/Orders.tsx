import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Download } from "lucide-react";
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

const STATUSES = ["pending", "paid", "fulfilled", "cancelled"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "offen", paid: "bezahlt", fulfilled: "versendet", cancelled: "storniert",
};
const STATUS_CLS: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  paid: "bg-green-100 text-green-800",
  fulfilled: "bg-blue-100 text-blue-800",
  cancelled: "bg-muted text-muted-foreground",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
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
