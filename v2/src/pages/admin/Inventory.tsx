import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dbErrorMessage } from "@/lib/utils";
import { downloadCsv } from "@/components/admin/csv";

const DEFAULT_LOW = 5;

async function fetchProducts() {
  const { data, error } = await supabase.from("products").select("id, name, status").order("name");
  if (error) throw error;
  return data;
}

async function fetchThreshold() {
  const { data, error } = await supabase.from("settings").select("low_stock_threshold").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data?.low_stock_threshold ?? DEFAULT_LOW;
}

/** All enabled colour × size cells below the threshold, across products (view low_stock). */
async function fetchLowStock() {
  const { data, error } = await supabase
    .from("low_stock")
    .select("*")
    .order("product_name")
    .order("variant_sort")
    .order("size_sort")
    .limit(1000);
  if (error) throw error;
  return data;
}

async function fetchGrid(productId: string) {
  const [{ data: sizes }, { data: variants }] = await Promise.all([
    supabase.from("product_sizes").select("size_id, sizes(name, sort_order)").eq("product_id", productId),
    supabase.from("variants").select("id, sort_order, colors(name), variant_size_availability(size_id, stock, available)").eq("product_id", productId).order("sort_order"),
  ]);
  const sizeList = (sizes ?? []).map((s: any) => ({ id: s.size_id, name: s.sizes?.name, sort: s.sizes?.sort_order ?? 0 })).sort((a, b) => a.sort - b.sort);
  return { sizeList, variants: variants ?? [] };
}

export default function Inventory() {
  const qc = useQueryClient();
  const { data: products } = useQuery({ queryKey: ["inv-products"], queryFn: fetchProducts });
  const { data: threshold = DEFAULT_LOW } = useQuery({ queryKey: ["inv-threshold"], queryFn: fetchThreshold });
  const { data: lowStock, error: lowError } = useQuery({ queryKey: ["inv-low"], queryFn: fetchLowStock });
  const [productId, setProductId] = useState<string>("");
  useEffect(() => { if (!productId && products?.length) setProductId(products[0].id); }, [products, productId]);

  const { data: grid, refetch, isFetching } = useQuery({ queryKey: ["inv-grid", productId], queryFn: () => fetchGrid(productId), enabled: !!productId });

  // edits keyed by `${variantId}:${sizeId}` -> stock number
  const [edits, setEdits] = useState<Record<string, number>>({});
  useEffect(() => { setEdits({}); }, [productId]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [withDrafts, setWithDrafts] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState<string | null>(null);

  const stockOf = (variant: any, sizeId: string) => {
    const key = `${variant.id}:${sizeId}`;
    if (key in edits) return edits[key];
    const av = (variant.variant_size_availability ?? []).find((a: any) => a.size_id === sizeId);
    return av?.stock ?? 0;
  };
  const dirty = Object.keys(edits).length > 0;

  const totals = useMemo(() => {
    if (!grid) return { total: 0, low: 0, out: 0 };
    let total = 0, low = 0, out = 0;
    for (const v of grid.variants) for (const s of grid.sizeList) {
      const n = stockOf(v, s.id); total += n;
      if (n === 0) out++; else if (n < threshold) low++;
    }
    return { total, low, out };
  }, [grid, edits, threshold]);

  const reorderList = (lowStock ?? []).filter((r) => withDrafts || r.product_status === "published");
  const pickProduct = (id: string) => {
    if (id !== productId && (!dirty || confirm("Ungespeicherte Bestandsänderungen verwerfen?"))) setProductId(id);
  };

  function refreshStock() {
    qc.invalidateQueries({ queryKey: ["inv-low"] });
    qc.invalidateQueries({ queryKey: ["admin-badges"] });
  }

  async function save() {
    setSaving(true); setMsg(null);
    // Read the cells fresh: orders may have sold a size out since the grid loaded.
    const variantIds = [...new Set(Object.keys(edits).map((k) => k.split(":")[0]))];
    const { data: current, error: readError } = await supabase
      .from("variant_size_availability").select("variant_id, size_id, stock, available").in("variant_id", variantIds);
    if (readError) { setSaving(false); setMsg("Fehler: " + dbErrorMessage(readError)); return; }
    // Same rule as a refund (mark_order_refunded): a size that was sold out
    // becomes available again with new stock; one switched off under
    // Produkt → Größen & Bestand stays off. The shop sells only available && stock > 0.
    const rows = Object.entries(edits).map(([k, stock]) => {
      const [variant_id, size_id] = k.split(":");
      const old = (current ?? []).find((a) => a.variant_id === variant_id && a.size_id === size_id);
      const available = old ? old.available || (old.stock <= 0 && stock > 0) : stock > 0;
      return { variant_id, size_id, stock, available };
    });
    const { error } = await supabase.from("variant_size_availability").upsert(rows, { onConflict: "variant_id,size_id" });
    setSaving(false);
    if (error) { setMsg("Fehler: " + dbErrorMessage(error)); return; }
    setEdits({}); setMsg(`${rows.length} Einträge gespeichert.`); refetch(); refreshStock();
  }

  async function saveThreshold() {
    if (thresholdDraft === null) return;
    const n = Number(thresholdDraft);
    if (!Number.isInteger(n) || n < 0 || n > 100000) { setMsg("Warnschwelle: ganze Zahl ab 0."); return; }
    const { error } = await supabase.from("settings").update({ low_stock_threshold: n }).eq("id", 1);
    if (error) { setMsg("Warnschwelle nicht gespeichert: " + dbErrorMessage(error)); return; }
    setThresholdDraft(null); setMsg(null);
    qc.invalidateQueries({ queryKey: ["inv-threshold"] });
    refreshStock();
  }

  function exportReorderList() {
    downloadCsv("nachbestellen.csv", [
      ["Produkt", "Farbe", "Größe", "Bestand", "Warnschwelle", "Status"],
      ...reorderList.map((r) => [r.product_name, r.color_name, r.size_name, r.stock, r.threshold, r.product_status === "published" ? "veröffentlicht" : "Entwurf"]),
    ]);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Bestand</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Lagerbestand je Variante & Größe. Bei 0 ist die Größe im Shop ausverkauft; mit neuem Bestand ist sie wieder lieferbar.
        Eine unter Produkt → Größen & Bestand abgeschaltete Größe mit Bestand („aus“) bleibt beim Speichern abgeschaltet.
      </p>

      {/* Cross-product reorder list */}
      <section className="mb-8 rounded-xl border p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Nachbestellen</h2>
          <span className="text-sm text-muted-foreground">alle Größen unter</span>
          <input
            type="number"
            min={0}
            aria-label="Warnschwelle"
            value={thresholdDraft ?? String(threshold)}
            onChange={(e) => setThresholdDraft(e.target.value)}
            onBlur={saveThreshold}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className="h-8 w-20 rounded border border-input bg-background px-2 text-center text-sm"
          />
          <span className="text-sm text-muted-foreground">Stück (Warnschwelle)</span>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input type="checkbox" checked={withDrafts} onChange={(e) => setWithDrafts(e.target.checked)} /> auch Entwürfe
          </label>
          <button
            type="button"
            onClick={exportReorderList}
            disabled={reorderList.length === 0}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
        {lowError ? (
          <p className="text-sm text-destructive">Liste nicht verfügbar – Migration 99940000000000_admin_catalog.sql ausführen. ({dbErrorMessage(lowError)})</p>
        ) : reorderList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Alles gut – keine Größe unter der Warnschwelle.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Produkt</th>
                  <th className="py-1.5 pr-3 font-medium">Farbe</th>
                  <th className="py-1.5 pr-3 font-medium">Größe</th>
                  <th className="py-1.5 text-right font-medium">Bestand</th>
                </tr>
              </thead>
              <tbody>
                {reorderList.map((r) => (
                  <tr
                    key={`${r.variant_id}:${r.size_id}`}
                    className="cursor-pointer border-b last:border-0 hover:bg-accent"
                    onClick={() => pickProduct(r.product_id)}
                    title="Im Bestandsraster unten öffnen"
                  >
                    <td className="py-1.5 pr-3">
                      {r.product_name}
                      {r.product_status !== "published" && <span className="ml-1.5 text-xs text-muted-foreground">(Entwurf)</span>}
                    </td>
                    <td className="py-1.5 pr-3">{r.color_name}</td>
                    <td className="py-1.5 pr-3">{r.size_name}</td>
                    <td className="py-1.5 text-right">
                      {r.stock === 0
                        ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">ausverkauft</span>
                        : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{r.stock}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={productId} onChange={(e) => pickProduct(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          {products?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status !== "published" ? " (Entwurf)" : ""}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">Summe: <b className="text-foreground">{totals.total}</b></span>
        {totals.out > 0 && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">{totals.out} ausverkauft</span>}
        {totals.low > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">{totals.low} niedrig (&lt;{threshold})</span>}
        <button onClick={save} disabled={!dirty || saving} className="ml-auto h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {saving ? "speichere…" : dirty ? `speichern (${Object.keys(edits).length})` : "gespeichert"}
        </button>
      </div>
      {msg && <p className="mb-3 text-sm text-muted-foreground">{msg}</p>}

      {isFetching && !grid ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : grid && grid.sizeList.length === 0 ? (
        <p className="text-sm text-muted-foreground">Dieses Produkt hat keine Größen.</p>
      ) : grid ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-semibold">Farbe</th>
                {grid.sizeList.map((s) => <th key={s.id} className="px-2 py-2 text-center font-semibold">{s.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.variants.map((v: any) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{v.colors?.name}</td>
                  {grid.sizeList.map((s) => {
                    const val = stockOf(v, s.id);
                    const low = val > 0 && val < threshold;
                    // switched off by the admin (a sold-out size has stock 0 instead)
                    const av = (v.variant_size_availability ?? []).find((a: any) => a.size_id === s.id);
                    const off = av && !av.available && av.stock > 0;
                    return (
                      <td key={s.id} className="px-2 py-1.5 text-center" title={off ? "Abgeschaltet unter Produkt → Größen & Bestand – wird im Shop nicht verkauft" : undefined}>
                        <input
                          type="number" min={0} value={val}
                          aria-label={`Bestand ${v.colors?.name ?? ""} ${s.name}`}
                          onChange={(e) => setEdits((p) => ({ ...p, [`${v.id}:${s.id}`]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                          className={"h-8 w-16 rounded border px-2 text-center text-sm " + (off ? "border-input text-muted-foreground" : val === 0 ? "border-red-200 bg-red-50 text-red-800" : low ? "border-amber-300 bg-amber-50" : "border-input")}
                        />
                        {off && <span className="block text-[10px] text-muted-foreground">aus</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
