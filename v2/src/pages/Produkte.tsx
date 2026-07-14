import ProductBrowser from "@/components/ProductBrowser";

export default function Produkte() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-5xl font-black lowercase leading-[0.95] sm:text-6xl">
        <span className="text-primary">alle </span><span className="italic text-secondary">produkte.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
        markentextilien zum selbstgestalten — wähle produkt, farbe und größe und leg los.
      </p>
      <div className="mt-10">
        <ProductBrowser />
      </div>
    </div>
  );
}
