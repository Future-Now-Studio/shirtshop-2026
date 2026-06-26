import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-image.jpg";
import { AboutTeaser, FaqSection, ContactBanner } from "@/components/home/sections";

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

  return (
    <div>
      {/* Hero */}
      <section className="relative mb-16 overflow-hidden rounded-3xl shadow-card">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/30" />
        <div className="relative max-w-2xl px-8 py-20 sm:px-14 sm:py-28">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
            Textildruck · Stickerei · ab 1 Stück
          </p>
          <h1 className="text-balance text-4xl font-extrabold leading-tight sm:text-6xl">
            Sei du selbst. <span className="gradient-text">Sei einzigartig.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Gestalte deine Textilien selbst im Browser — Motiv platzieren, Farbe und Größe wählen,
            fertig. Vom Einzelstück bis zur Großbestellung.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#produkte">
              <Button size="lg" className="shadow-glow">
                Produkte ansehen <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <Link to="/grossbestellung">
              <Button size="lg" variant="outline">Großbestellung</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="produkte">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-extrabold">Unsere Produkte</h2>
            <p className="mt-1 text-muted-foreground">Wähle ein Produkt und gestalte es nach deinen Wünschen.</p>
          </div>
          <span className="text-sm text-muted-foreground">{data?.length ?? 0} Artikel</span>
        </div>

        {isLoading && <p className="text-muted-foreground">Lade Produkte…</p>}
        {error && <p className="text-destructive">Fehler: {(error as Error).message}</p>}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((p) => (
            <Link
              key={p.id}
              to={`/produkt/${p.slug}`}
              className="hover-lift group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card"
            >
              {/* color band */}
              <div className="flex h-36 overflow-hidden">
                {(p.variants ?? []).slice(0, 6).map((v: any) => (
                  <div key={v.id} className="h-full flex-1" style={{ backgroundColor: v.colors?.hex }} title={v.colors?.name} />
                ))}
                {(!p.variants || p.variants.length === 0) && (
                  <div className="h-full flex-1 bg-gradient-to-br from-muted to-accent" />
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold leading-tight transition-colors group-hover:text-primary">{p.name}</h3>
                </div>
                {p.category && (
                  <span className="mt-1 inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                    {p.category}
                  </span>
                )}
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-primary">{Number(p.base_price).toFixed(2)} €</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Gestalten <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <AboutTeaser />
      <FaqSection />
      <ContactBanner />
    </div>
  );
}
