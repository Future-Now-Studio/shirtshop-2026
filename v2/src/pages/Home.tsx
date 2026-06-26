import ProductGrid from "@/components/ProductGrid";
import Hero from "@/components/home/Hero";
import { AboutTeaser, FaqSection, ContactBanner, ProductHighlights, ShopBento, LocationsTeaser } from "@/components/home/sections";

export default function Home() {
  return (
    <div>
      <Hero />

      <ProductHighlights />
      <ShopBento />

      {/* Products */}
      <section id="produkte" className="mt-20">
        <div className="mb-6">
          <h2 className="text-3xl font-extrabold lowercase">unsere produkte</h2>
          <p className="mt-1 text-muted-foreground">wähle ein produkt und gestalte es nach deinen wünschen.</p>
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
