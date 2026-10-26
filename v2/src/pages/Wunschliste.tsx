import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useWishlist } from "@/stores/wishlist";
import HeartButton from "@/components/HeartButton";
import { LinkButton } from "@/components/LinkButton";
import { eur } from "@/lib/utils";
import { PRICE_NOTE } from "@/lib/pricing";

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
        <LinkButton to="/produkte" variant="outline" className="mt-4">Produkte entdecken</LinkButton>
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
            // heart button sits beside the link: a button inside <a> is invalid HTML
            <div key={p.id} className="hover-lift group relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
              <div className="absolute right-3 top-3 z-10"><HeartButton id={p.id} /></div>
              <Link to={`/produkt/${p.slug}`} className="block">
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-white">
                  {url ? <img loading="lazy" decoding="async" src={url} alt={p.name} className="h-full w-full object-contain p-3" /> : (
                    <div className="flex h-full w-full">{(p.variants ?? []).slice(0, 6).map((v: any) => <div key={v.id} className="h-full flex-1" style={{ backgroundColor: v.hex ?? v.colors?.hex }} />)}</div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold transition-colors group-hover:text-primary">{p.name}</h3>
                  <span className="mt-2 block text-lg font-bold text-primary">{eur(Number(p.base_price))}<span className="block text-[10px] font-normal text-muted-foreground">{PRICE_NOTE}</span></span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
