import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/ProductCard";
import { useProductsByCategory, useWooCommerceCategories } from "@/hooks/useProducts";
import { Loader2 } from "lucide-react";

const targetGroups = ["Damen", "Herren", "Kinder & Babys"];

const Produkte = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | number>("alle produkte");
  const [selectedTarget, setSelectedTarget] = useState("Herren");

  const { data: categories = [], isLoading: categoriesLoading } = useWooCommerceCategories();
  const { data: products = [], isLoading: productsLoading, error } = useProductsByCategory(selectedCategory);
  
  const isLoading = categoriesLoading || productsLoading;

  return (
    <Layout>
      {/* Hero */}
      <section className="pt-12 pb-8 bg-gradient-to-b from-accent/30 to-background">
        <div className="container-wide">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-6xl font-bold text-primary mb-4"
          >
            shop, shop, <span className="text-secondary">hooray.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl"
          >
            Entdecke unsere große Auswahl an hochwertigen Textilien für jeden Anlass
          </motion.p>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-20 z-30 bg-background/95 backdrop-blur-md border-b border-border py-4">
        <div className="container-wide">
          {/* Target Groups */}
          <div className="flex gap-4 mb-4">
            {targetGroups.map((target) => (
              <Button
                key={target}
                variant={selectedTarget === target ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedTarget(target)}
              >
                {target}
              </Button>
            ))}
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {/* "All Products" button */}
            <Button
              variant={selectedCategory === "alle produkte" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("alle produkte")}
              className="rounded-full"
            >
              alle produkte
            </Button>
            {/* Dynamic categories from WooCommerce */}
            {categories
              .filter(cat => cat.count > 0) // Only show categories with products
              .map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="rounded-full"
                >
                  {category.name} ({category.count})
                </Button>
              ))}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="section-padding">
        <div className="container-wide">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Produkte werden geladen...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <p className="text-destructive mb-4">Fehler beim Laden der Produkte</p>
                <Button onClick={() => window.location.reload()}>Neu laden</Button>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <p className="text-muted-foreground">Keine Produkte gefunden</p>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {products.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Produkte;
