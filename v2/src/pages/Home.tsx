import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-image.jpg";
import ProductGrid from "@/components/ProductGrid";
import { AboutTeaser, FaqSection, ContactBanner, ProductHighlights, ShopBento, LocationsTeaser } from "@/components/home/sections";

export default function Home() {
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
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
            <span>★ Über 1 Mio. Bestellungen</span>
            <span>★ Lokale Produktion</span>
            <span>★ Schnelle Lieferung</span>
          </div>
        </div>
      </section>

      <ProductHighlights />
      <ShopBento />

      {/* Products */}
      <section id="produkte" className="mt-20">
        <div className="mb-6">
          <h2 className="text-3xl font-extrabold">Unsere Produkte</h2>
          <p className="mt-1 text-muted-foreground">Wähle ein Produkt und gestalte es nach deinen Wünschen.</p>
        </div>
        <ProductGrid />
      </section>

      <AboutTeaser />
      <FaqSection />
      <LocationsTeaser />
      <ContactBanner />
    </div>
  );
}
