import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import HeartButton from "@/components/HeartButton";

async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, description, base_price, category, created_at, variants(id, hex, colors(name, hex), variant_images(view, storage_path), variant_size_availability(available, stock))")
    .eq("status", "published")
    .order("created_at");
  if (error) throw error;
  return data;
}

function isSoldOut(p: any) {
  const av = (p.variants ?? []).flatMap((v: any) => v.variant_size_availability ?? []);
  if (av.length === 0) return false; // no size data → assume available
  return av.every((a: any) => !a.available || (a.stock ?? 0) <= 0);
}

type Sort = "new" | "price-asc" | "price-desc" | "name";

export default function ProductBrowser() {
  const { data, isLoading, error } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("alle");
  const [sort, setSort] = useState<Sort>("new");

  const categories = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((p) => p.category && set.add(p.category));
    return ["alle", ...Array.from(set).sort()];
  }, [data]);

  const visible = useMemo(() => {
    let list = (data ?? []).filter((p) => cat === "alle" || p.category === cat);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((p) => (p.name + " " + (p.description ?? "")).toLowerCase().includes(needle));
    }
    const s = [...list];
    if (sort === "price-asc") s.sort((a, b) => Number(a.base_price) - Number(b.base_price));
    else if (sort === "price-desc") s.sort((a, b) => Number(b.base_price) - Number(a.base_price));
    else if (sort === "name") s.sort((a, b) => a.name.localeCompare(b.name));
    else s.reverse(); // newest first (fetched asc by created_at)
    return s;
  }, [data, q, cat, sort]);

  return (
    <div>
      {/* Controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Produkt suchen…"
            className="h-10 w-full rounded-full border border-input bg-background pl-9 pr-4 text-sm"
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 rounded-full border border-input bg-background px-4 text-sm">
          <option value="new">Neueste</option>
          <option value="price-asc">Preis aufsteigend</option>
          <option value="price-desc">Preis absteigend</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {categories.length > 2 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={"rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors " +
                (cat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent")}>
              {c}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Lade Produkte…</p>}
      {error && <p className="text-destructive">Fehler: {(error as Error).message}</p>}
      {!isLoading && visible.length === 0 && <p className="text-muted-foreground">Keine Produkte gefunden.</p>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => {
          const img = (p.variants ?? [])[0]?.variant_images?.find((i: any) => i.view === "front");
          const url = img ? supabase.storage.from("product-images").getPublicUrl(img.storage_path).data.publicUrl : null;
          const soldOut = isSoldOut(p);
          return (
            <Link key={p.id} to={`/produkt/${p.slug}`} className="hover-lift group relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
              <div className="absolute right-3 top-3 z-10"><HeartButton id={p.id} /></div>
              {soldOut && <span className="absolute left-3 top-3 z-10 rounded-full bg-neutral-900/85 px-2.5 py-1 text-xs font-medium text-white">ausverkauft</span>}
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-white">
                {url ? (
                  <img src={url} alt={p.name} className={"h-full w-full object-contain p-3 " + (soldOut ? "opacity-60" : "")} />
                ) : (p.variants ?? []).length > 0 ? (
                  <div className="flex h-full w-full">
                    {(p.variants ?? []).slice(0, 6).map((v: any) => (
                      <div key={v.id} className="h-full flex-1" style={{ backgroundColor: v.hex ?? v.colors?.hex }} title={v.colors?.name} />
                    ))}
                  </div>
                ) : <div className="h-full w-full bg-muted" />}
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold leading-tight transition-colors group-hover:text-primary">{p.name}</h3>
                {p.category && <span className="mt-1 inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">{p.category}</span>}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-primary">{Number(p.base_price).toFixed(2)} €</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    {soldOut ? "ansehen" : "gestalten"} <ArrowRight className="h-4 w-4" />
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
