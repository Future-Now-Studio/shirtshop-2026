import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/ProductCard";
import { useProductsByCategory, useWooCommerceCategories } from "@/hooks/useProducts";
import { Loader2 } from "lucide-react";

const targetGroups = ["alle", "damen", "herren", "kinder & babys"];

const Produkte = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | number>("alle produkte");
  const [selectedTarget, setSelectedTarget] = useState<string | null>("alle");

  const { data: categories = [], isLoading: categoriesLoading } = useWooCommerceCategories();
  const { data: products = [], isLoading: productsLoading, error } = useProductsByCategory(selectedCategory);
  
  // Map target groups to geschlecht values
  const geschlechtMap: Record<string, string[]> = {
    "damen": ["damen", "frau", "weiblich", "female"],
    "herren": ["herren", "mann", "männlich", "male"],
    "kinder & babys": ["kinder", "kinder & babys", "baby", "babys", "unisex", "unisex"],
  };

  // Filter products by geschlecht
  const filteredProducts = products.filter(product => {
    // If "Alle" is selected or no target selected, show all products
    if (!selectedTarget || selectedTarget === "alle" || selectedTarget.toLowerCase() === "alle") return true;
    
    const geschlechtValues = geschlechtMap[selectedTarget] || [];
    if (!product.geschlecht) return false;
    
    return geschlechtValues.some(value => 
      product.geschlecht?.toLowerCase().includes(value.toLowerCase()) ||
      value.toLowerCase().includes(product.geschlecht.toLowerCase())
    );
  });
  
  const isLoading = categoriesLoading || productsLoading;

  return (
    <Layout>
      <Seo
        title="Produkte – T-Shirts, Hoodies & mehr"
        description="Entdecke unser Sortiment an T-Shirts, Hoodies und Sweatshirts. Hochwertige Textilien, individuell veredelbar mit Druck oder Stickerei."
        canonical="/produkte"
      />
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
            entdecke unsere große auswahl an hochwertigen textilien für jeden anlass
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
                onClick={() => setSelectedTarget(target === "alle" ? "alle" : target)}
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

      {/* TEMP: Product grid hidden – coming soon */}
      <section className="section-padding">
        <div className="container-wide flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <p className="text-2xl font-semibold">Bald verfügbar</p>
            <p className="text-muted-foreground">Unser Shop wird gerade vorbereitet.<br />Schau bald wieder rein!</p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Produkte;
