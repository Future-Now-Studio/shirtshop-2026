import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { publicUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";

const VIEWS = ["front", "back", "left", "right"] as const;
const VIEW_LABEL: Record<string, string> = { front: "Vorne", back: "Hinten", left: "Links", right: "Rechts" };

async function fetchProduct(slug: string) {
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, slug, name, description, category, base_price, design_element_price,
       variants(id, sort_order, colors(id, name, hex), variant_images(view, storage_path),
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
  const [sizeId, setSizeId] = useState<string | null>(null);

  if (isLoading) return <p className="text-muted-foreground">Lade…</p>;
  if (error || !p) return <p className="text-destructive">Produkt nicht gefunden.</p>;

  const variant: any = variants[variantIdx];
  const image = variant?.variant_images?.find((i: any) => i.view === view);
  const availForSize = (sid: string) =>
    variant?.variant_size_availability?.find((a: any) => a.size_id === sid && a.available && a.stock > 0);

  return (
    <div className="grid gap-10 md:grid-cols-2">
      {/* Gallery */}
      <div>
        <div className="aspect-square overflow-hidden rounded-xl border bg-muted/30">
          {image ? (
            <img src={publicUrl(image.storage_path)} alt={p.name} className="h-full w-full object-cover" />
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
                onClick={() => {
                  setVariantIdx(i);
                  setSizeId(null);
                }}
                title={v.colors?.name}
                className={
                  "h-9 w-9 rounded-full border-2 " + (i === variantIdx ? "border-primary" : "border-transparent")
                }
                style={{ backgroundColor: v.colors?.hex }}
              />
            ))}
          </div>
        </div>

        {/* Sizes */}
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Größe</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s: any) => {
              const ok = availForSize(s.id);
              return (
                <button
                  key={s.id}
                  disabled={!ok}
                  onClick={() => setSizeId(s.id)}
                  className={
                    "min-w-[3rem] rounded-md border px-3 py-2 text-sm " +
                    (sizeId === s.id ? "border-primary bg-primary text-primary-foreground" : "") +
                    (!ok ? " cursor-not-allowed text-muted-foreground line-through opacity-40" : "")
                  }
                >
                  {s.name}
                </button>
              );
            })}
            {sizes.length === 0 && <span className="text-sm text-muted-foreground">Keine Größen hinterlegt.</span>}
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Button disabled={!sizeId} className="px-8">
            In den Warenkorb
          </Button>
          <Link to={`/gestalten/${p.slug}`}>
            <Button variant="outline">Selbst gestalten</Button>
          </Link>
        </div>
        {!sizeId && <p className="mt-2 text-xs text-muted-foreground">Bitte Größe wählen.</p>}
      </div>
    </div>
  );
}
