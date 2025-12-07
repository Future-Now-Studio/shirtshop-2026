import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useProduct, useProductVariations } from "@/hooks/useProducts";
import { useCartStore } from "@/stores/cartStore";
import { ShoppingBag, Check, ArrowLeft, Palette, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const ProduktDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, error } = useProduct(Number(id));
  const { data: variations = [] } = useProductVariations(Number(id));
  const addItem = useCartStore((state) => state.addItem);

  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (product) {
      setSelectedColor(product.colors[0] || "");
      setSelectedImageIndex(0);
    }
  }, [product]);

  // Get all available images for the current selection
  const availableImages = useMemo(() => {
    if (!product) {
      return [];
    }

    const images: string[] = [];

    // If variations exist, get images from matching variations
    if (variations.length > 0) {
      const matchingVariations = variations.filter(variation => {
        const colorAttr = variation.attributes?.find(attr => 
          attr.name.toLowerCase().includes('color') || 
          attr.name.toLowerCase().includes('farbe') ||
          attr.name.toLowerCase().includes('colour')
        );
        
        const sizeAttr = variation.attributes?.find(attr => 
          attr.name.toLowerCase().includes('size') || 
          attr.name.toLowerCase().includes('größe') || 
          attr.name.toLowerCase().includes('groesse')
        );

        const colorMatch = colorAttr && selectedColor 
          ? colorAttr.option.toLowerCase() === selectedColor.toLowerCase()
          : false;
        
        const sizeMatch = sizeAttr && selectedSize
          ? sizeAttr.option.toLowerCase() === selectedSize.toLowerCase()
          : false;

        // If both color and size are selected, match both
        if (selectedColor && selectedSize) {
          return colorMatch && sizeMatch;
        } 
        // If only color is selected, match color
        else if (selectedColor && !selectedSize) {
          return colorMatch;
        }
        
        return false;
      });

      // Add variation images
      matchingVariations.forEach(variation => {
        if (variation.image?.src && !images.includes(variation.image.src)) {
          images.push(variation.image.src);
        }
      });
    }

    // Add product images (if not already included)
    if (product.images && product.images.length > 0) {
      product.images.forEach(img => {
        if (!images.includes(img)) {
          images.push(img);
        }
      });
    } else if (product.image && !images.includes(product.image)) {
      images.push(product.image);
    }

    return images.length > 0 ? images : [product.image];
  }, [product, variations, selectedColor, selectedSize]);

  // Reset image index when images change
  useEffect(() => {
    setSelectedImageIndex(0);
  }, [availableImages.length, selectedColor, selectedSize]);

  const currentImage = availableImages[selectedImageIndex] || product?.image || '';

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % availableImages.length);
  };

  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + availableImages.length) % availableImages.length);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Produkt wird geladen...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !product) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Produkt nicht gefunden</h1>
            <p className="text-muted-foreground mb-4">
              {error ? "Fehler beim Laden des Produkts" : "Das angeforderte Produkt existiert nicht."}
            </p>
            <Link to="/produkte">
              <Button>Zurück zu Produkten</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const handleAddToCart = () => {
    if (!selectedSize) {
      toast.error("Bitte wähle eine Größe");
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: currentImage, // Use the current variation image
      color: selectedColor,
      size: selectedSize,
      quantity: 1,
    });

    toast.success("Zum Warenkorb hinzugefügt!");
  };

  return (
    <Layout>
      <div className="container-wide py-8">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            to="/produkte"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zu Produkten
          </Link>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <div className="aspect-square rounded-3xl overflow-hidden bg-white relative group border border-border/50">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImage}
                  src={currentImage}
                  alt={product.name}
                  className="w-full h-full object-contain"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </AnimatePresence>

              {/* Navigation arrows - only show if multiple images */}
              {availableImages.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-background/80 hover:bg-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-background/80 hover:bg-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-5 h-5 text-foreground" />
                  </button>
                </>
              )}

              {/* Image counter */}
              {availableImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 px-3 py-1 rounded-full text-sm text-foreground">
                  {selectedImageIndex + 1} / {availableImages.length}
                </div>
              )}
            </div>

            {/* Thumbnail gallery */}
            {availableImages.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {availableImages.map((img, index) => (
                  <button
                    key={img}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImageIndex === index
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} - Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col"
          >
            <span className="text-sm text-primary font-medium mb-2">
              {product.category}
            </span>
            <h1 className="text-3xl lg:text-4xl font-bold mb-4 lowercase">
              {product.name}
            </h1>
            <p className="text-3xl font-bold text-primary mb-6">
              {product.priceFormatted}
            </p>

            <p className="text-muted-foreground mb-8">{product.description}</p>

            {/* Features */}
            <div className="mb-8">
              <h3 className="font-semibold mb-3">Eigenschaften</h3>
              <ul className="space-y-2">
                {product.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-secondary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Colors */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">
                Farbe: <span className="text-primary">{selectedColor}</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                      selectedColor === color
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            {/* Sizes */}
            <div className="mb-8">
              <h3 className="font-semibold mb-3">Größe</h3>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`w-12 h-12 rounded-xl border-2 font-semibold transition-all ${
                      selectedSize === size
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 mt-auto">
              <Button size="xl" className="flex-1 group" onClick={handleAddToCart}>
                <ShoppingBag className="w-5 h-5" />
                In den Warenkorb
              </Button>
              <Link 
                to={`/selbst-gestalten?productImage=${encodeURIComponent(product?.images[selectedImageIndex] || product?.image || '')}&productId=${product?.id || ''}`}
                className="flex-1"
              >
                <Button variant="outline" size="xl" className="w-full">
                  <Palette className="w-5 h-5" />
                  Selbst gestalten
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default ProduktDetail;
