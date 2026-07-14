import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const LOW = 5;

async function fetchProducts() {
  const { data, error } = await supabase.from("products").select("id, name").order("name");
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
  const { data: products } = useQuery({ queryKey: ["inv-products"], queryFn: fetchProducts });
  const [productId, setProductId] = useState<string>("");
  useEffect(() => { if (!productId && products?.length) setProductId(products[0].id); }, [products, productId]);

  const { data: grid, refetch, isFetching } = useQuery({ queryKey: ["inv-grid", productId], queryFn: () => fetchGrid(productId), enabled: !!productId });

  // edits keyed by `${variantId}:${sizeId}` -> stock number
  const [edits, setEdits] = useState<Record<string, number>>({});
  useEffect(() => { setEdits({}); }, [productId]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const stockOf = (variant: any, sizeId: string) => {
    const key = `${variant.id}:${sizeId}`;
    if (key in edits) return edits[key];
    const av = (variant.variant_size_availability ?? []).find((a: any) => a.size_id === sizeId);
    return av?.stock ?? 0;
  };
  const dirty = Object.keys(edits).length > 0;

  const totals = useMemo(() => {
    if (!grid) return { total: 0, low: 0 };
    let total = 0, low = 0;
    for (const v of grid.variants) for (const s of grid.sizeList) {
      const n = stockOf(v, s.id); total += n; if (n > 0 && n < LOW) low++;
    }
    return { total, low };
  }, [grid, edits]);

  async function save() {
    setSaving(true); setMsg(null);
    const rows = Object.entries(edits).map(([k, stock]) => {
      const [variant_id, size_id] = k.split(":");
      return { variant_id, size_id, stock, available: stock > 0 };
    });
    const { error } = await supabase.from("variant_size_availability").upsert(rows, { onConflict: "variant_id,size_id" });
    setSaving(false);
    if (error) { setMsg("Fehler: " + error.message); return; }
    setEdits({}); setMsg(`${rows.length} Einträge gespeichert.`); refetch();
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Bestand</h1>
      <p className="mb-6 text-sm text-muted-foreground">Lagerbestand je Variante & Größe. Bei 0 wird die Größe automatisch als „nicht verfügbar“ markiert.</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">Summe: <b className="text-foreground">{totals.total}</b></span>
        {totals.low > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">{totals.low} niedrig (&lt;{LOW})</span>}
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
                    const low = val > 0 && val < LOW;
                    return (
                      <td key={s.id} className="px-2 py-1.5 text-center">
                        <input
                          type="number" min={0} value={val}
                          onChange={(e) => setEdits((p) => ({ ...p, [`${v.id}:${s.id}`]: Math.max(0, Number(e.target.value)) }))}
                          className={"h-8 w-16 rounded border px-2 text-center text-sm " + (val === 0 ? "border-input bg-muted/50 text-muted-foreground" : low ? "border-amber-300 bg-amber-50" : "border-input")}
                        />
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
