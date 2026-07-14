import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { publicUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { useCart } from "@/stores/cart";
import HeartButton from "@/components/HeartButton";
import { SizeChartButton, Reviews, SimilarProducts } from "@/components/ProductExtras";

const VIEWS = ["front", "back", "left", "right"] as const;
const VIEW_LABEL: Record<string, string> = { front: "Vorne", back: "Hinten", left: "Links", right: "Rechts" };

async function fetchProduct(slug: string) {
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, slug, name, description, category, base_price, design_element_price,
       variants(id, hex, sort_order, colors(id, name, hex), variant_images(view, storage_path),
                variant_size_availability(size_id, available, stock)),
       product_sizes(sizes(id, name, sort_order))`
    )
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  if (error) throw error;
  return data;
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: p, isLoading, error } = useQuery({ queryKey: ["product-detail", slug], queryFn: () => fetchProduct(slug!) });

  const variants = useMemo(
    () => (p?.variants ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order),
    [p]
  );
  const sizes = useMemo(
    () =>
      (p?.product_sizes ?? [])
        .map((ps: any) => ps.sizes)
        .sort((a: any, b: any) => a.sort_order - b.sort_order),
    [p]
  );

  const [variantIdx, setVariantIdx] = useState(0);
  const [view, setView] = useState<string>("front");
  const [sizeQty, setSizeQty] = useState<Record<string, number>>({});
  const addToCart = useCart((s) => s.add);
  const navigate = useNavigate();

  if (isLoading) return <p className="text-muted-foreground">Lade…</p>;
  if (error || !p) return <p className="text-destructive">Produkt nicht gefunden.</p>;

  const variant: any = variants[variantIdx];
  const image =
    variant?.variant_images?.find((i: any) => i.view === view) ||
    variant?.variant_images?.find((i: any) => i.view === "front") ||
    variant?.variant_images?.[0];
  const availForSize = (sid: string) =>
    variant?.variant_size_availability?.find((a: any) => a.size_id === sid && a.available && a.stock > 0);
  const totalPieces = Object.values(sizeQty).reduce((s, q) => s + (q || 0), 0);

  function handleAdd() {
    const entries = Object.entries(sizeQty).filter(([, q]) => q > 0);
    if (entries.length === 0) return;
    const front = variant?.variant_images?.find((i: any) => i.view === "front") || variant?.variant_images?.[0];
    for (const [sid, q] of entries) {
      addToCart({
        productId: p.id,
        productName: p.name,
        slug: p.slug,
        variantId: variant.id,
        colorName: variant.colors?.name,
        sizeId: sid,
        sizeName: sizes.find((s: any) => s.id === sid)?.name ?? null,
        qty: q,
        basePrice: Number(p.base_price),
        designElementPrice: Number(p.design_element_price),
        designElementCount: 0,
        thumbnail: front ? publicUrl(front.storage_path) : undefined,
      });
    }
    navigate("/warenkorb");
  }

  return (
    <div>
    <div className="grid gap-10 md:grid-cols-2">
      {/* Gallery */}
      <div>
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-white">
          <div className="absolute right-3 top-3 z-10"><HeartButton id={p.id} /></div>
          {image ? (
            <img src={publicUrl(image.storage_path)} alt={p.name} className="h-full w-full object-contain p-4" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Kein Bild</div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          {VIEWS.map((v) => {
            const has = variant?.variant_images?.some((i: any) => i.view === v);
            return (
              <button
                key={v}
                disabled={!has}
                onClick={() => setView(v)}
                className={
                  "rounded-md border px-3 py-1.5 text-xs " +
                  (view === v ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground") +
                  (!has ? " opacity-30" : "")
                }
              >
                {VIEW_LABEL[v]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Alle Produkte</Link>
        <h1 className="mt-2 text-3xl font-semibold">{p.name}</h1>
        <p className="mt-1 text-2xl tabular-nums">{Number(p.base_price).toFixed(2)} €</p>
        {p.description && <p className="mt-4 text-muted-foreground">{p.description}</p>}

        {/* Colors */}
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Farbe: {variant?.colors?.name}</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v: any, i: number) => (
              <button
                key={v.id}
                onClick={() => { setVariantIdx(i); setSizeQty({}); }}
                title={v.colors?.name}
                className={
                  "h-9 w-9 rounded-full border-2 " + (i === variantIdx ? "border-primary ring-2 ring-primary/30" : "border-border")
                }
                style={{ backgroundColor: v.hex ?? v.colors?.hex }}
              />
            ))}
          </div>
        </div>

        {/* Sizes × quantity */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Menge je Größe</p>
            <SizeChartButton />
          </div>
          <div className="divide-y rounded-xl border">
            {sizes.map((s: any) => {
              const ok = availForSize(s.id);
              const q = sizeQty[s.id] ?? 0;
              const setQ = (n: number) => setSizeQty((m) => ({ ...m, [s.id]: Math.max(0, Math.min(ok?.stock ?? 999, n)) }));
              return (
                <div key={s.id} className={"flex items-center justify-between gap-3 px-3 py-2.5 " + (!ok ? "opacity-40" : "")}>
                  <span className="text-sm font-medium">
                    {s.name}{!ok && <span className="ml-2 text-xs text-muted-foreground">ausverkauft</span>}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button disabled={!ok || q <= 0} onClick={() => setQ(q - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent disabled:opacity-30">−</button>
                    <input type="number" min={0} disabled={!ok} value={q} onChange={(e) => setQ(Number(e.target.value))} className="h-8 w-12 rounded-md border border-input bg-background text-center text-sm" />
                    <button disabled={!ok} onClick={() => setQ(q + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent disabled:opacity-30">+</button>
                  </div>
                </div>
              );
            })}
            {sizes.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Keine Größen hinterlegt.</p>}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{totalPieces} Stück gesamt</span>
          <span className="font-bold tabular-nums">{(Number(p.base_price) * totalPieces).toFixed(2)} €</span>
        </div>

        <div className="mt-4 flex gap-3">
          <Button disabled={totalPieces === 0} className="px-8" onClick={handleAdd}>
            In den Warenkorb
          </Button>
          <Link to={`/gestalten/${p.slug}`}>
            <Button variant="outline">Selbst gestalten</Button>
          </Link>
        </div>
        {totalPieces === 0 && <p className="mt-2 text-xs text-muted-foreground">Mindestens 1 Stück wählen.</p>}
      </div>
    </div>

      <Reviews productId={p.id} />
      <SimilarProducts category={p.category} excludeId={p.id} />
    </div>
  );
}
