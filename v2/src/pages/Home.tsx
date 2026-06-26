import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, description, base_price, category, variants(id, colors(name, hex))")
    .eq("status", "published")
    .order("created_at");
  if (error) throw error;
  return data;
}

export default function Home() {
  const { data, isLoading, error } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  if (isLoading) return <p className="text-muted-foreground">Lade Produkte…</p>;
  if (error) return <p className="text-destructive">Fehler: {(error as Error).message}</p>;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Produkte</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {data?.length ?? 0} veröffentlichte Produkte aus Supabase (anon, RLS-gefiltert).
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((p) => (
          <Link key={p.id} to={`/produkt/${p.slug}`} className="rounded-lg border p-4 transition-colors hover:bg-accent">
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium">{p.name}</h2>
              <span className="text-sm tabular-nums">{Number(p.base_price).toFixed(2)} €</span>
            </div>
            {p.category && (
              <span className="mt-1 inline-block rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {p.category}
              </span>
            )}
            <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
            <div className="mt-3 flex gap-1.5">
              {p.variants?.map((v: any) => (
                <span
                  key={v.id}
                  title={v.colors?.name}
                  className="h-5 w-5 rounded-full border"
                  style={{ backgroundColor: v.colors?.hex }}
                />
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
