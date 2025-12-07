import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ProductCard } from "@/components/products/ProductCard";
import { useHighlightedProducts, useProducts } from "@/hooks/useProducts";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ProductSlider = () => {
  const { data: highlightedProducts = [], isLoading: isLoadingHighlighted, error: highlightedError } = useHighlightedProducts();
  const { data: allProducts = [] } = useProducts({ per_page: 8 });
  
  // Use highlighted products if available, otherwise show first 8 products as fallback
  const products = highlightedProducts.length > 0 ? highlightedProducts : allProducts.slice(0, 8);
  const isLoading = isLoadingHighlighted;
  const error = highlightedError;

  if (isLoading) {
    return (
      <section className="section-padding bg-muted/30">
        <div className="container-wide">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Produkte werden geladen...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Show error or empty state - still show the section structure
  if (error) {
    console.error('Error loading highlighted products:', error);
  }

  // If no highlighted products, show empty state with message
  if (products.length === 0) {
    return (
      <section className="section-padding bg-muted/30">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
              <h2 className="text-4xl lg:text-5xl font-bold">
                <span className="text-primary">highlights</span>
                <br />
                <span className="text-secondary italic">für dich.</span>
              </h2>
            </div>
            <p className="text-muted-foreground mb-6">
              {error 
                ? "Fehler beim Laden der Produkte. Bitte versuchen Sie es später erneut."
                : "Keine Highlights verfügbar. Fügen Sie das Tag 'highlight' zu Produkten in WooCommerce hinzu."}
            </p>
            <Link to="/produkte">
              <Button variant="outline" size="lg" className="group">
                alle produkte ansehen
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section className="section-padding bg-muted/30">
      <div className="container-wide">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" />
              <div>
                <h2 className="text-4xl lg:text-5xl font-bold">
                  <span className="text-primary">highlights</span>
                  <br />
                  <span className="text-secondary italic">für dich.</span>
                </h2>
                <p className="text-muted-foreground mt-2">
                  Unsere ausgewählten Favoriten – besonders beliebt und hochwertig
                </p>
              </div>
            </div>
            <Link to="/produkte">
              <Button variant="outline" size="lg" className="group">
                alle produkte
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {products.map((product, index) => (
                <CarouselItem
                  key={product.id}
                  className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                >
                  <ProductCard product={product} index={index} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex -left-4 lg:-left-12" />
            <CarouselNext className="hidden sm:flex -right-4 lg:-right-12" />
          </Carousel>
        </motion.div>
      </div>
    </section>
  );
};

