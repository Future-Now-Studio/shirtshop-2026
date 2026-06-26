import { Link } from "react-router-dom";
import { MousePointerClick, Upload, ShoppingCart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductGrid from "@/components/ProductGrid";

const STEPS = [
  { icon: MousePointerClick, title: "Produkt wählen", text: "Such dir ein Textil aus, wähle Farbe und Größe." },
  { icon: Upload, title: "Motiv gestalten", text: "Lade dein Design hoch oder füge Text hinzu — direkt in den Druckzonen." },
  { icon: ShoppingCart, title: "Bestellen", text: "Ab in den Warenkorb, sicher bezahlen, wir drucken & liefern." },
];

export default function SelbstGestalten() {
  return (
    <div className="animate-fade-in">
      <section className="overflow-hidden rounded-3xl gradient-bg px-8 py-16 text-center text-primary-foreground shadow-glow sm:px-14">
        <h1 className="text-4xl font-extrabold sm:text-6xl">Selbst gestalten</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/90">
          In drei Schritten zu deinem individuellen Textil — komplett im Browser, ohne Vorkenntnisse.
        </p>
      </section>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold text-primary">Schritt {i + 1}</p>
            <h3 className="mt-1 text-xl font-bold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-3xl font-extrabold">Jetzt Produkt wählen</h2>
          <Link to="/produkte" className="hidden sm:block">
            <Button variant="outline">Alle Produkte <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </Link>
        </div>
        <ProductGrid />
      </div>
    </div>
  );
}
