import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { designExpired, useCart, unitPrice } from "@/stores/cart";
import { fetchDiscountData, computeTotals, nextVolumeTier, vatLabel } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { DeliveryTime } from "@/components/DeliveryTime";
import { eur } from "@/lib/utils";

/**
 * Sizes selectable per variant (only sizes the product still offers), with
 * availability + stock, and the variants (colours) that no longer exist — a
 * persisted cart can outlive catalogue changes, and checkout would reject it.
 */
async function fetchSizeOptions(variantIds: string[]) {
  const opts: Record<string, SizeOpt[]> = {};
  const gone = new Set<string>();
  if (!variantIds.length) return { opts, gone };
  const [avail, vars] = await Promise.all([
    supabase
      .from("variant_size_availability")
      .select("variant_id, size_id, available, stock, sizes(name, sort_order)")
      .in("variant_id", variantIds),
    supabase.from("variants").select("id, products(product_sizes(size_id))").in("id", variantIds),
  ]);
  if (avail.error) throw avail.error;
  if (vars.error) throw vars.error;
  const offered = new Map<string, Set<string>>();
  for (const v of vars.data ?? []) {
    offered.set(v.id, new Set(((v as any).products?.product_sizes ?? []).map((ps: any) => ps.size_id)));
  }
  for (const id of variantIds) if (!offered.has(id)) gone.add(id);
  for (const r of avail.data ?? []) {
    if (!offered.get(r.variant_id)?.has(r.size_id)) continue;
    (opts[r.variant_id] ??= []).push({
      sizeId: r.size_id,
      name: (r as any).sizes?.name ?? "—",
      sort: (r as any).sizes?.sort_order ?? 0,
      available: r.available && (r.stock ?? 0) > 0,
      stock: r.stock ?? 0,
    });
  }
  for (const k of Object.keys(opts)) opts[k].sort((a, b) => a.sort - b.sort);
  return { opts, gone };
}
type SizeOpt = { sizeId: string; name: string; sort: number; available: boolean; stock: number };

export default function Cart() {
  const { items, remove, setQty, setSize, syncPrices } = useCart();
  const productIds = [...new Set(items.map((i) => i.productId))];
  const variantIds = [...new Set(items.map((i) => i.variantId))];
  const { data, isError, refetch } = useQuery({
    queryKey: ["cart-discounts", productIds.join(",")],
    queryFn: () => fetchDiscountData(productIds),
  });
  const { data: sizeOpts } = useQuery({
    queryKey: ["cart-sizes", variantIds.join(",")],
    queryFn: () => fetchSizeOptions(variantIds),
  });
  // Prices are stored with the cart line; bring them up to date with the
  // catalogue (the checkout charges current prices) and say so.
  const [pricesChanged, setPricesChanged] = useState(false);
  useEffect(() => {
    if (data && syncPrices(data.prices)) setPricesChanged(true);
  }, [data, syncPrices]);

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
  const nextTier = data && totals && totals.eligibleQty > 0 ? nextVolumeTier(totals.eligibleQty, data.discounts) : null;
  const unavailable = (i: (typeof items)[number]) =>
    (!!data && !data.prices[i.productId]) || !!sizeOpts?.gone.has(i.variantId);
  // No size chosen, or the chosen size was removed from the product.
  const missingSize = (i: (typeof items)[number]) => {
    const opts = sizeOpts?.opts[i.variantId] ?? [];
    return opts.length > 0 && !opts.some((o) => o.sizeId === i.sizeId);
  };
  const blocker = items.some(unavailable)
    ? "Bitte entferne Artikel, die nicht mehr erhältlich sind."
    : items.some(designExpired)
      ? "Ein Design ist älter als 4 Wochen und nicht mehr gespeichert. Bitte entferne die Position und gestalte sie neu."
    : items.some(missingSize)
      ? "Bitte wähle für jede Position eine Größe."
      : null;

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
              {unavailable(i) && <p className="text-xs font-medium text-destructive">Nicht mehr erhältlich</p>}
              {designExpired(i) && <p className="text-xs font-medium text-destructive">Design abgelaufen – bitte neu gestalten</p>}
            </div>

            {/* Controls: eigene Zeile auf Mobile */}
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            {/* Größe */}
            {(() => {
              const opts = sizeOpts?.opts[i.variantId] ?? [];
              const known = opts.some((o) => o.sizeId === i.sizeId);
              if (opts.length === 0)
                return <span className="w-16 text-center text-xs text-muted-foreground">{i.sizeName ?? "—"}</span>;
              return (
                <select
                  value={known ? i.sizeId! : ""}
                  onChange={(e) => {
                    const o = opts.find((x) => x.sizeId === e.target.value);
                    if (o) setSize(i.key, o.sizeId, o.name);
                  }}
                  className="h-9 w-20 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
                  aria-label="Größe"
                >
                  {!known && <option value="" disabled>Größe</option>}
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
              const opt = (sizeOpts?.opts[i.variantId] ?? []).find((o) => o.sizeId === i.sizeId);
              const max = opt?.stock ?? 999;
              const set = (n: number) => setQty(i.key, Math.max(1, Math.min(max, n)));
              return (
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => set(i.qty - 1)} disabled={i.qty <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent disabled:opacity-30">−</button>
                  <input type="number" min={1} max={max} value={i.qty}
                    onChange={(e) => set(Math.trunc(Number(e.target.value)) || 0)}
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

      {pricesChanged && (
        <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Die Preise einiger Artikel haben sich seit dem Hinzufügen geändert. Dein Warenkorb zeigt die aktuellen Preise.
        </p>
      )}

      <div className="mt-6 ml-auto max-w-sm rounded-2xl border bg-card p-6 shadow-card">
        {isError && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            Die Preise konnten nicht geladen werden.{" "}
            <button type="button" className="underline" onClick={() => refetch()}>Erneut versuchen</button>
          </p>
        )}
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
          {nextTier && (
            <p className="text-xs text-muted-foreground">
              Noch {nextTier.missing} Stück bis {nextTier.pct} % Mengenrabatt.
            </p>
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
        <DeliveryTime className="mt-4" />
        {blocker && <p className="mt-3 text-sm text-destructive">{blocker}</p>}
        {totals && !blocker ? (
          <Link to="/kasse" className="mt-4 block">
            <Button className="w-full" size="lg">Zur Kasse</Button>
          </Link>
        ) : (
          <Button className="mt-4 w-full" size="lg" disabled>Zur Kasse</Button>
        )}
      </div>
    </div>
  );
}
