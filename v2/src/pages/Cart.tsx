import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCart, unitPrice } from "@/stores/cart";
import { fetchDiscountData, computeTotals, vatLabel } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { eur } from "@/lib/utils";

/** Sizes selectable per variant, with availability + stock. */
async function fetchSizeOptions(variantIds: string[]) {
  if (!variantIds.length) return {} as Record<string, SizeOpt[]>;
  const { data, error } = await supabase
    .from("variant_size_availability")
    .select("variant_id, size_id, available, stock, sizes(name, sort_order)")
    .in("variant_id", variantIds);
  if (error) throw error;
  const map: Record<string, SizeOpt[]> = {};
  for (const r of data ?? []) {
    (map[r.variant_id] ??= []).push({
      sizeId: r.size_id,
      name: (r as any).sizes?.name ?? "—",
      sort: (r as any).sizes?.sort_order ?? 0,
      available: r.available && (r.stock ?? 0) > 0,
      stock: r.stock ?? 0,
    });
  }
  for (const k of Object.keys(map)) map[k].sort((a, b) => a.sort - b.sort);
  return map;
}
type SizeOpt = { sizeId: string; name: string; sort: number; available: boolean; stock: number };

export default function Cart() {
  const { items, remove, setQty, setSize } = useCart();
  const productIds = [...new Set(items.map((i) => i.productId))];
  const variantIds = [...new Set(items.map((i) => i.variantId))];
  const { data } = useQuery({
    queryKey: ["cart-discounts", productIds.join(",")],
    queryFn: () => fetchDiscountData(productIds),
  });
  const { data: sizeOpts } = useQuery({
    queryKey: ["cart-sizes", variantIds.join(",")],
    queryFn: () => fetchSizeOptions(variantIds),
  });

  if (items.length === 0)
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Dein Warenkorb ist leer.</p>
        <Link to="/" className="mt-4 inline-block">
          <Button variant="outline">Produkte ansehen</Button>
        </Link>
      </div>
    );

  const totals = data ? computeTotals(items, data.discounts, data.excluded, data.cfg) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-3xl font-extrabold">Warenkorb</h1>
      <ul className="divide-y rounded-2xl border bg-card shadow-card">
        {items.map((i) => (
          <li key={i.key} className="flex flex-wrap items-center gap-3 p-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted/30">
              {i.thumbnail ? (
                <img loading="lazy" decoding="async" src={i.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">kein Bild</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.productName}</p>
              <p className="text-xs text-muted-foreground">
                {i.colorName}
                {i.designElementCount > 0 && ` · ${i.designElementCount} Design-Element(e)`}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">{eur(unitPrice(i))} / Stück</p>
            </div>

            {/* Controls: eigene Zeile auf Mobile */}
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            {/* Größe */}
            {(() => {
              const opts = sizeOpts?.[i.variantId] ?? [];
              if (opts.length === 0)
                return <span className="w-16 text-center text-xs text-muted-foreground">{i.sizeName ?? "—"}</span>;
              return (
                <select
                  value={i.sizeId ?? ""}
                  onChange={(e) => {
                    const o = opts.find((x) => x.sizeId === e.target.value);
                    if (o) setSize(i.key, o.sizeId, o.name);
                  }}
                  className="h-9 w-20 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
                  aria-label="Größe"
                >
                  {opts.map((o) => (
                    <option key={o.sizeId} value={o.sizeId} disabled={!o.available}>
                      {o.name}{!o.available ? " (aus)" : ""}
                    </option>
                  ))}
                </select>
              );
            })()}

            {/* Menge */}
            {(() => {
              const opt = (sizeOpts?.[i.variantId] ?? []).find((o) => o.sizeId === i.sizeId);
              const max = opt?.stock ?? 999;
              const set = (n: number) => setQty(i.key, Math.max(1, Math.min(max, n)));
              return (
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => set(i.qty - 1)} disabled={i.qty <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent disabled:opacity-30">−</button>
                  <input type="number" min={1} max={max} value={i.qty}
                    onChange={(e) => set(Number(e.target.value))}
                    className="h-9 w-12 rounded-md border border-input bg-background text-center text-sm" />
                  <button onClick={() => set(i.qty + 1)} disabled={i.qty >= max}
                    className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent disabled:opacity-30">+</button>
                </div>
              );
            })()}

            <span className="w-16 shrink-0 text-right text-sm tabular-nums">{eur((unitPrice(i) * i.qty))}</span>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => remove(i.key)} aria-label={`${i.productName} entfernen`}>
              <Trash2 className="h-4 w-4" />
            </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 ml-auto max-w-sm rounded-2xl border bg-card p-6 shadow-card">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Zwischensumme</span>
            <span className="tabular-nums">{totals ? eur(totals.subtotal) : "… €"}</span>
          </div>
          {totals && totals.pct > 0 && (
            <div className="flex justify-between font-medium text-secondary-foreground">
              <span>Mengenrabatt ({totals.pct}%)</span>
              <span className="tabular-nums">−{eur(totals.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Versand</span>
            <span className="tabular-nums">{totals ? (totals.shipping === 0 ? "gratis" : `${eur(totals.shipping)}`) : "…"}</span>
          </div>
          {totals && totals.shipping > 0 && (
            <p className="text-xs text-muted-foreground">
              Noch {eur(totals.cfg.freeShippingThreshold - totals.goodsTotal)} bis zum Gratisversand.
            </p>
          )}
          <div className="flex justify-between border-t pt-2 text-lg font-bold">
            <span>Gesamt</span>
            <span className="tabular-nums text-primary">{totals ? eur(totals.grandTotal) : "… €"}</span>
          </div>
          {totals && (
            <p className="text-right text-xs text-muted-foreground">inkl. {eur(totals.vat)} MwSt ({vatLabel(totals.cfg)})</p>
          )}
        </div>
        <Link to="/kasse" className="mt-4 block">
          <Button className="w-full" size="lg">Zur Kasse</Button>
        </Link>
      </div>
    </div>
  );
}
