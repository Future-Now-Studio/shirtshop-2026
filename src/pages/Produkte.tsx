import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/ProductCard";
import productPolo from "@/assets/product-polo.jpg";
import productTshirt from "@/assets/product-tshirt.jpg";
import productHoodie from "@/assets/product-hoodie.jpg";

const categories = ["alle produkte", "T-Shirts", "Polohemden", "Sweatshirts", "Hoodies", "Jacken"];
const targetGroups = ["Damen", "Herren", "Kinder & Babys"];

const products = [
  { id: 1, name: "Oxford Hemd KA", price: "19,90 €", image: productPolo, colors: 4, category: "Polohemden" },
  { id: 2, name: "B&C Exact 190", price: "8,95 €", image: productTshirt, colors: 16, category: "T-Shirts" },
  { id: 3, name: "Ladies Running-T", price: "15,95 €", image: productTshirt, colors: 12, category: "T-Shirts" },
  { id: 4, name: "B&C Piqué Polo", price: "18,95 €", image: productPolo, colors: 16, category: "Polohemden" },
  { id: 5, name: "Kapuzen Sweatshirt", price: "26,95 €", image: productHoodie, colors: 17, category: "Hoodies" },
  { id: 6, name: "Set In Sweatshirt", price: "22,95 €", image: productHoodie, colors: 9, category: "Sweatshirts" },
  { id: 7, name: "Premium T-Shirt", price: "12,95 €", image: productTshirt, colors: 20, category: "T-Shirts" },
  { id: 8, name: "Classic Polo", price: "16,95 €", image: productPolo, colors: 14, category: "Polohemden" },
];

const Produkte = () => {
  const [selectedCategory, setSelectedCategory] = useState("alle produkte");
  const [selectedTarget, setSelectedTarget] = useState("Herren");

  const filteredProducts =
    selectedCategory === "alle produkte"
      ? products
      : products.filter((p) => p.category === selectedCategory);

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
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="rounded-full"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="section-padding">
        <div className="container-wide">
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Produkte;
