import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCart, unitPrice, type CartItem } from "@/stores/cart";
import { Button } from "@/components/ui/button";

async function fetchDiscountData(productIds: string[]) {
  const [discounts, products] = await Promise.all([
    supabase.from("volume_discounts").select("min_qty, discount_percent").order("min_qty"),
    productIds.length
      ? supabase.from("products").select("id, excluded_from_volume_discount").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (discounts.error) throw discounts.error;
  if (products.error) throw products.error;
  return { discounts: discounts.data, excluded: new Set(products.data!.filter((p) => p.excluded_from_volume_discount).map((p) => p.id)) };
}

export function computeTotals(items: CartItem[], discounts: { min_qty: number; discount_percent: number }[], excluded: Set<string>) {
  const subtotal = items.reduce((s, i) => s + unitPrice(i) * i.qty, 0);
  const eligibleQty = items.filter((i) => !excluded.has(i.productId)).reduce((s, i) => s + i.qty, 0);
  const eligibleSubtotal = items.filter((i) => !excluded.has(i.productId)).reduce((s, i) => s + unitPrice(i) * i.qty, 0);
  const tier = [...discounts].filter((d) => d.min_qty <= eligibleQty).sort((a, b) => b.min_qty - a.min_qty)[0];
  const pct = tier?.discount_percent ?? 0;
  const discount = (eligibleSubtotal * pct) / 100;
  return { subtotal, eligibleQty, pct, discount, total: subtotal - discount };
}

export default function Cart() {
  const { items, remove, setQty } = useCart();
  const productIds = [...new Set(items.map((i) => i.productId))];
  const { data } = useQuery({
    queryKey: ["cart-discounts", productIds.join(",")],
    queryFn: () => fetchDiscountData(productIds),
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

  const totals = data ? computeTotals(items, data.discounts, data.excluded) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">Warenkorb</h1>
      <ul className="divide-y rounded-lg border">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-4 p-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted/30">
              {i.thumbnail ? (
                <img src={i.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">kein Bild</div>
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">{i.productName}</p>
              <p className="text-xs text-muted-foreground">
                {i.colorName} · {i.sizeName ?? "—"}
                {i.designElementCount > 0 && ` · ${i.designElementCount} Design-Element(e)`}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">{unitPrice(i).toFixed(2)} € / Stück</p>
            </div>
            <input
              type="number"
              min={1}
              value={i.qty}
              onChange={(e) => setQty(i.key, Number(e.target.value))}
              className="h-9 w-16 rounded-md border border-input bg-background px-2 text-sm"
            />
            <span className="w-20 text-right text-sm tabular-nums">{(unitPrice(i) * i.qty).toFixed(2)} €</span>
            <Button variant="ghost" size="icon" onClick={() => remove(i.key)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-6 ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Zwischensumme</span>
          <span className="tabular-nums">{totals?.subtotal.toFixed(2) ?? "…"} €</span>
        </div>
        {totals && totals.pct > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Mengenrabatt ({totals.pct}%)</span>
            <span className="tabular-nums">−{totals.discount.toFixed(2)} €</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
          <span>Gesamt</span>
          <span className="tabular-nums">{totals?.total.toFixed(2) ?? "…"} €</span>
        </div>
        <Link to="/kasse" className="block pt-3">
          <Button className="w-full">Zur Kasse</Button>
        </Link>
      </div>
    </div>
  );
}
