import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useWishlist } from "@/stores/wishlist";
import HeartButton from "@/components/HeartButton";
import { Button } from "@/components/ui/button";

async function fetchByIds(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, base_price, category, variants(id, hex, colors(hex), variant_images(view, storage_path))")
    .in("id", ids).eq("status", "published");
  if (error) throw error;
  return data;
}

export default function Wunschliste() {
  const ids = useWishlist((s) => s.ids);
  const { data } = useQuery({ queryKey: ["wishlist", ids.join(",")], queryFn: () => fetchByIds(ids) });

  if (ids.length === 0)
    return (
      <div className="py-16 text-center">
        <Heart className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Deine Merkliste ist leer.</p>
        <Link to="/produkte" className="mt-4 inline-block"><Button variant="outline">Produkte entdecken</Button></Link>
      </div>
    );

  return (
    <div>
      <h1 className="mb-8 text-4xl font-black lowercase"><span className="text-primary">deine </span><span className="italic text-secondary">merkliste.</span></h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((p) => {
          const img = (p.variants ?? [])[0]?.variant_images?.find((i: any) => i.view === "front");
          const url = img ? supabase.storage.from("product-images").getPublicUrl(img.storage_path).data.publicUrl : null;
          return (
            <Link key={p.id} to={`/produkt/${p.slug}`} className="hover-lift group relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
              <div className="absolute right-3 top-3 z-10"><HeartButton id={p.id} /></div>
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-white">
                {url ? <img src={url} alt={p.name} className="h-full w-full object-contain p-3" /> : (
                  <div className="flex h-full w-full">{(p.variants ?? []).slice(0, 6).map((v: any) => <div key={v.id} className="h-full flex-1" style={{ backgroundColor: v.hex ?? v.colors?.hex }} />)}</div>
                )}
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold transition-colors group-hover:text-primary">{p.name}</h3>
                <span className="mt-2 block text-lg font-bold text-primary">{Number(p.base_price).toFixed(2)} €</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
