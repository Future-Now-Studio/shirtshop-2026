import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, description, base_price, category, variants(id, colors(name, hex), variant_images(view, storage_path))")
    .eq("status", "published")
    .order("created_at");
  if (error) throw error;
  return data;
}

export default function ProductGrid() {
  const { data, isLoading, error } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [activeCat, setActiveCat] = useState("alle");

  const categories = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((p) => p.category && set.add(p.category));
    return ["alle", ...Array.from(set).sort()];
  }, [data]);

  const visible = useMemo(
    () => (data ?? []).filter((p) => activeCat === "alle" || p.category === activeCat),
    [data, activeCat]
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{visible.length} Artikel</span>
      </div>

      {categories.length > 2 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={
                "rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors " +
                (activeCat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground")
              }
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Lade Produkte…</p>}
      {error && <p className="text-destructive">Fehler: {(error as Error).message}</p>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => {
          const img = (p.variants ?? [])[0]?.variant_images?.find((i: any) => i.view === "front");
          const url = img ? supabase.storage.from("product-images").getPublicUrl(img.storage_path).data.publicUrl : null;
          return (
            <Link
              key={p.id}
              to={`/produkt/${p.slug}`}
              className="hover-lift group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card"
            >
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-white">
                {url ? (
                  <img src={url} alt={p.name} className="h-full w-full object-contain p-3" />
                ) : (p.variants ?? []).length > 0 ? (
                  <div className="flex h-full w-full">
                    {(p.variants ?? []).slice(0, 6).map((v: any) => (
                      <div key={v.id} className="h-full flex-1" style={{ backgroundColor: v.hex ?? v.colors?.hex }} title={v.colors?.name} />
                    ))}
                  </div>
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-muted to-accent" />
                )}
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold leading-tight transition-colors group-hover:text-primary">{p.name}</h3>
                {p.category && (
                  <span className="mt-1 inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                    {p.category}
                  </span>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-primary">{Number(p.base_price).toFixed(2)} €</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Gestalten <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
