import ProductGrid from "@/components/ProductGrid";

export default function Produkte() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Alle Produkte</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Markentextilien zum Selbstgestalten — wähle Produkt, Farbe und Größe und leg los.
      </p>
      <div className="mt-10">
        <ProductGrid />
      </div>
    </div>
  );
}
