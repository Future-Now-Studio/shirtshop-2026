import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Upload, Palette, Package, Truck, Sparkles } from "lucide-react";
import designYourselfVideo from "@/assets/design-yourself.mp4";
import heroImage from "@/assets/hero-image.jpg";
import { useDesignerProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/products/ProductCard";

const steps = [
  { icon: Package, title: "1. Produkt wählen", description: "Wähle aus unserer großen Auswahl an Textilien" },
  { icon: Upload, title: "2. Design hochladen", description: "Lade dein eigenes Design oder Logo hoch" },
  { icon: Palette, title: "3. Gestalten", description: "Passe Farben, Position und Größe an" },
  { icon: Truck, title: "4. Bestellen", description: "Erhalte deine Produkte in wenigen Tagen" },
];

const DesignerProductsGrid = () => {
  const { data: products, isLoading } = useDesignerProducts();

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card aspect-square animate-pulse bg-muted" />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Keine Produkte mit Designer-Tag gefunden.
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product, index) => (
        <Link
          key={product.id}
          to={`/designer?productImage=${encodeURIComponent(product.image)}`}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="glass-card overflow-hidden hover-lift cursor-pointer"
          >
            <div className="relative aspect-square overflow-hidden bg-muted">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-foreground lowercase">
                {product.name}
              </h3>
              <p className="text-lg font-bold text-primary mt-1">
                {product.priceFormatted}
              </p>
            </div>
          </motion.div>
        </Link>
      ))}
    </div>
  );
};

const SelbstGestalten = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src={designYourselfVideo} type="video/mp4" />
            {/* Fallback image if video fails to load */}
            <img
              src={heroImage}
              alt="Design"
              className="w-full h-full object-cover"
            />
          </video>
        </div>
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/40 to-foreground/20" />

        <div className="container-wide relative z-10 text-center py-20">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-7xl font-bold mb-6"
          >
            <span className="text-background drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">selbst</span>
            <br />
            <span className="text-secondary drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">gestalten.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-background mb-8 max-w-2xl mx-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
          >
            Erstelle dein einzigartiges Design in wenigen Schritten. 
            Einfach, schnell und professionell.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/designer">
              <Button variant="hero" size="xl" className="group">
                <Sparkles className="w-5 h-5" />
                Creator starten
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl lg:text-5xl font-bold text-center text-primary mb-16"
          >
            So einfach geht's
          </motion.h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto bg-accent rounded-2xl flex items-center justify-center mb-6 relative">
                  <step.icon className="w-10 h-10 text-primary" />
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute -right-12 top-1/2 w-8 h-0.5 bg-border" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Selection */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl lg:text-5xl font-bold text-primary mb-4">
              Produkt auswählen
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Wähle ein Produkt aus, um mit dem Creator zu starten
            </p>
          </motion.div>

          <DesignerProductsGrid />
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-muted/30">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 text-center"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-4">
              Bereit für dein eigenes Design?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Starte jetzt mit unserem intuitiven Creator und erstelle 
              einzigartige Textilien für dich oder dein Team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/designer">
                <Button size="xl" className="group">
                  <Sparkles className="w-5 h-5" />
                  Jetzt Creator öffnen
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/produkte">
                <Button variant="outline" size="xl">
                  Produkte ansehen
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default SelbstGestalten;
