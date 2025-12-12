import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useProduct, useProductVariations, useWooCommerceProduct } from "@/hooks/useProducts";
import { useCartStore } from "@/stores/cartStore";
import { ShoppingBag, Check, ArrowLeft, Palette, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

// Helper function to extract hex color from variation description
function extractHexFromDescription(description?: string): string | null {
  if (!description) return null;
  // Look for hex color patterns: #RRGGBB or #RGB
  const hexMatch = description.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/);
  return hexMatch ? hexMatch[0] : null;
}

const ProduktDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, error } = useProduct(Number(id));
  const { data: wcProduct } = useWooCommerceProduct(Number(id));
  const { data: variations = [] } = useProductVariations(Number(id));
  const addItem = useCartStore((state) => state.addItem);

  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Helper function to find color attribute (more robust matching)
  const findColorAttribute = (attributes: any[]) => {
    if (!attributes) return null;
    return attributes.find(attr => {
      const nameLower = (attr.name || '').toLowerCase();
      const slugLower = (attr.slug || '').toLowerCase();
      return (
        nameLower === 'farbe' ||
        nameLower === 'color' ||
        nameLower === 'colour' ||
        nameLower.includes('farbe') ||
        nameLower.includes('color') ||
        nameLower.includes('colour') ||
        slugLower === 'farbe' ||
        slugLower === 'color' ||
        slugLower === 'colour' ||
        slugLower.includes('farbe') ||
        slugLower.includes('color') ||
        slugLower.includes('colour')
      );
    });
  };

  // Get available colors from variations with hex codes and names
  const availableColors = useMemo(() => {
    if (!variations || variations.length === 0) return [];
    
    const colorMap = new Map<string, { name: string; hex: string | null }>();
    variations.forEach(variation => {
      const colorAttr = findColorAttribute(variation.attributes || []);
      if (colorAttr?.option) {
        const cleanColor = String(colorAttr.option).trim();
        if (cleanColor && !colorMap.has(cleanColor)) {
          const hex = extractHexFromDescription(variation.description);
          colorMap.set(cleanColor, { name: cleanColor, hex });
        }
      }
    });
    return Array.from(colorMap.values());
  }, [variations]);

  useEffect(() => {
    if (product) {
      // Use availableColors from variations if available, otherwise fall back to product.colors
      const colorsToUse = availableColors.length > 0 ? availableColors.map(c => c.name) : product.colors;
      if (colorsToUse.length > 0 && !selectedColor) {
        setSelectedColor(colorsToUse[0]);
      }
      setSelectedImageIndex(0);
    }
  }, [product, availableColors]);

  // Get all available images for the current selection
  const availableImages = useMemo(() => {
    console.log('=== Loading Images ===');
    console.log('Selected Color:', selectedColor);
    console.log('Selected Size:', selectedSize);
    
    if (!product) {
      console.log('No product, returning empty array');
      return [];
    }

    const images: string[] = [];

    // ALWAYS try to get SVI images first when color is selected (same logic as T-Shirt Designer)
    if (selectedColor && wcProduct) {
      console.log('=== Searching for SVI Gallery Images ===');
      console.log('Selected Color (Farbe attribute value):', selectedColor);
      
      const sviMeta = wcProduct.meta_data?.find((meta: any) => meta.key === 'woosvi_slug');
      
      if (sviMeta && sviMeta.value && Array.isArray(sviMeta.value)) {
        console.log('✓ Found SVI meta data with', sviMeta.value.length, 'entries');
        console.log('SVI Entries structure:', JSON.stringify(sviMeta.value, null, 2));
        
        // Find the entry that matches the selected color (by matching the "Farbe" attribute value)
        const matchingSviEntry = sviMeta.value.find((entry: any) => {
          if (!entry.slugs || !Array.isArray(entry.slugs)) {
            console.log('  Entry has no slugs array:', entry);
            return false;
          }
          
          console.log('  Checking SVI entry with slugs:', entry.slugs);
          console.log('  Comparing against selected color value:', selectedColor);
          
          // Match by comparing the selected color value with slugs in SVI data
          const match = entry.slugs.some((slug: string) => {
            const slugStr = String(slug).trim();
            const colorStr = String(selectedColor).trim();
            const matches = slugStr === colorStr;
            console.log(`    Comparing SVI slug "${slugStr}" with color "${colorStr}": ${matches}`);
            return matches;
          });
          
          if (match) {
            console.log('  ✓ Found matching SVI gallery entry!', entry);
          }
          return match;
        });
        
        if (matchingSviEntry && matchingSviEntry.imgs && Array.isArray(matchingSviEntry.imgs)) {
          console.log('✓ Matching SVI gallery entry found with', matchingSviEntry.imgs.length, 'image IDs');
          console.log('  SVI Image IDs:', matchingSviEntry.imgs);
          
          // Get image IDs from SVI data
          const imageIds = matchingSviEntry.imgs.map((id: any) => String(id));
          
          console.log('  Looking for images with these IDs in wcProduct.images...');
          console.log('  Available image IDs in wcProduct:', wcProduct.images?.map(img => ({ id: img.id, name: img.name })));
          
          // Find images in product.images array that match these IDs
          const matchingImages = wcProduct.images?.filter(img => {
            const matches = imageIds.includes(String(img.id));
            if (matches) {
              console.log(`    ✓ Found SVI gallery image: ID ${img.id}, name: ${img.name}, src: ${img.src}`);
            }
            return matches;
          }) || [];
          
          console.log('✓ Found', matchingImages.length, 'SVI gallery images');
          
          // Add all SVI images to the gallery - these are the correct images to use
          matchingImages.forEach(img => {
            if (img.src && !images.includes(img.src)) {
              console.log('  Adding SVI gallery image to display:', img.src);
              images.push(img.src);
            }
          });
          
          console.log('✓ Total SVI gallery images loaded:', images.length);
          
          // If we found SVI images, return them immediately - don't fall back to variation images
          if (images.length > 0) {
            console.log('=== Returning SVI gallery images (skipping variation fallback) ===');
            const finalImages = images;
            console.log('Final SVI images:', finalImages);
            console.log('=== End Loading Images ===\n');
            return finalImages;
          }
        } else {
          console.log('✗ No matching SVI gallery entry found or entry has no images');
          if (matchingSviEntry) {
            console.log('  Entry structure:', matchingSviEntry);
          }
        }
      } else {
        console.log('✗ No SVI meta data found or invalid format');
        if (wcProduct.meta_data) {
          console.log('  Available meta_data keys:', wcProduct.meta_data.map((m: any) => m.key));
        } else {
          console.log('  wcProduct.meta_data is undefined or null');
        }
      }
    } else {
      console.log('✗ Skipping SVI search - selectedColor:', selectedColor, 'wcProduct:', !!wcProduct);
    }

    // Only fall back to variation images if NO SVI images were found
    if (images.length === 0 && variations.length > 0 && selectedColor) {
      console.log('=== No SVI gallery images found, falling back to variation images ===');
      console.log('Searching', variations.length, 'variations for color:', selectedColor);
      
      // Find all variations matching the selected color
      const matchingVariations = variations.filter(variation => {
        const colorAttr = findColorAttribute(variation.attributes || []);
        
        if (!colorAttr || !colorAttr.option) {
          console.log('Variation', variation.id, 'has no color attribute');
          return false;
        }
        
        // Convert both to strings and compare (handles numbers like "741")
        const attrOption = String(colorAttr.option).trim();
        const selectedColorValue = String(selectedColor).trim();
        const matches = attrOption === selectedColorValue;
        
        console.log(`Variation ${variation.id}: color attribute "${attrOption}" vs selected "${selectedColorValue}": ${matches}`);
        return matches;
      });

      console.log('Found', matchingVariations.length, 'matching variations');

      // Collect images from all matching variations
      matchingVariations.forEach(variation => {
        console.log('Processing variation', variation.id);
        // Check if variation has a gallery (images array from Smart Variations Images plugin)
        if (variation.images && variation.images.length > 0) {
          console.log('  Variation has', variation.images.length, 'gallery images');
          // Use the variation's gallery images
          variation.images.forEach(img => {
            if (img.src && !images.includes(img.src)) {
              console.log('  Adding gallery image:', img.src);
              images.push(img.src);
            }
          });
        }
        
        // Also check for main variation image
        if (variation.image?.src && !images.includes(variation.image.src)) {
          console.log('  Adding main variation image:', variation.image.src);
          images.push(variation.image.src);
        }
      });
    }
    
    // If size is also selected, try to find exact match (but still show color images if found)
    if (variations.length > 0 && selectedColor && selectedSize) {
      const exactMatch = variations.find(variation => {
        const colorAttr = findColorAttribute(variation.attributes || []);
        
        const sizeAttr = variation.attributes?.find(attr => 
          attr.name.toLowerCase().includes('size') || 
          attr.name.toLowerCase().includes('größe') || 
          attr.name.toLowerCase().includes('groesse')
        );

        const colorMatch = colorAttr && selectedColor 
          ? String(colorAttr.option).trim() === String(selectedColor).trim()
          : false;
        
        const sizeMatch = sizeAttr && selectedSize
          ? String(sizeAttr.option).trim().toLowerCase() === String(selectedSize).trim().toLowerCase()
          : false;

        return colorMatch && sizeMatch;
      });

      // If exact match found, prioritize its images
      if (exactMatch) {
        const exactImages: string[] = [];
        if (exactMatch.images && exactMatch.images.length > 0) {
          exactMatch.images.forEach(img => {
            if (img.src && !exactImages.includes(img.src)) {
              exactImages.push(img.src);
            }
          });
        }
        if (exactMatch.image?.src && !exactImages.includes(exactMatch.image.src)) {
          exactImages.push(exactMatch.image.src);
        }
        // If exact match has images, use those; otherwise keep color-based images
        if (exactImages.length > 0) {
          return exactImages;
        }
        // If exact match has no images but we have color-based images, use those
        if (images.length > 0) {
          return images;
        }
      } else if (images.length > 0) {
        // No exact match but we have color-based images
        return images;
      }
    } else if (images.length > 0) {
      // Color selected but no size, return color-based images
      return images;
    }

    // If no variation images found, fall back to product images
    if (images.length === 0) {
      if (product.images && product.images.length > 0) {
        product.images.forEach(img => {
          if (!images.includes(img)) {
            images.push(img);
          }
        });
      } else if (product.image && !images.includes(product.image)) {
        images.push(product.image);
      }
    }

    const finalImages = images.length > 0 ? images : [product.image];
    console.log('=== Final Result ===');
    console.log('Total images found:', finalImages.length);
    if (finalImages.length > 0) {
      console.log('Image sources:', finalImages);
      if (images.length > 0) {
        console.log('✓ Using SVI gallery images');
      } else {
        console.log('⚠ Using fallback images (variation or product)');
      }
    }
    console.log('=== End Loading Images ===\n');
    return finalImages;
  }, [product, wcProduct, variations, selectedColor, selectedSize]);

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
            {availableColors.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">
                  Farbe{selectedColor && `: ${selectedColor}`}
                </h3>
                <TooltipProvider>
                  <div className="flex flex-wrap gap-3">
                    {availableColors.map((color) => (
                      <Tooltip key={color.name}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setSelectedColor(color.name)}
                            className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                              selectedColor === color.name
                                ? "border-primary ring-2 ring-primary/20 scale-110"
                                : "border-border hover:border-primary/50 hover:scale-105"
                            }`}
                            style={{
                              backgroundColor: color.hex || "#ccc",
                            }}
                            aria-label={color.name}
                          >
                            {selectedColor === color.name && (
                              <Check className="w-5 h-5 text-white drop-shadow-md" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{color.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              </div>
            )}

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
