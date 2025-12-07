import { motion } from "framer-motion";
import { ShoppingBag, Palette, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { Product } from "@/data/products";

interface ProductCardProps {
  product: Product;
  index: number;
}

export const ProductCard = ({ product, index }: ProductCardProps) => {
  const addItem = useCartStore((state) => state.addItem);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      color: product.colors[0] || "Standard",
      size: product.sizes[0] || "M",
      quantity: 1,
    });
    
    toast.success("Zum Warenkorb hinzugefügt!");
  };

  const colorCount = product.colors.length;
  
  // Check if product has "designer" tag
  const hasDesignerTag = product.tags?.some(
    tag => tag.slug.toLowerCase() === 'designer' || tag.name.toLowerCase() === 'designer'
  ) || false;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group"
      whileHover={{ y: -8 }}
    >
      <div className="glass-card overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:shadow-primary/20">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-muted">
          <Link to={`/produkt/${product.id}`} className="block h-full w-full">
            <motion.img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </Link>
          
          {/* Overlay on hover */}
          <motion.div 
            className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300 flex items-center justify-center gap-3 pointer-events-none"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* View Details Button - Always visible */}
            <Link to={`/produkt/${product.id}`} className="pointer-events-auto">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 bg-background rounded-full flex items-center justify-center shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors"
                title="Details ansehen"
              >
                <Eye className="w-5 h-5 text-primary group-hover:text-primary-foreground transition-colors" />
              </motion.button>
            </Link>
            
            {/* Quick Add Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleQuickAdd}
              className="w-12 h-12 bg-background rounded-full flex items-center justify-center shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors pointer-events-auto"
              title="In den Warenkorb"
            >
              <ShoppingBag className="w-5 h-5 text-primary group-hover:text-primary-foreground transition-colors" />
            </motion.button>
            
            {/* Customize Button - Only show if product has "designer" tag */}
            {hasDesignerTag && (
              <Link to={`/selbst-gestalten?productImage=${encodeURIComponent(product.image)}`} className="pointer-events-auto">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-12 h-12 bg-background rounded-full flex items-center justify-center shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors"
                  title="Selbst gestalten"
                >
                  <Palette className="w-5 h-5 text-primary group-hover:text-primary-foreground transition-colors" />
                </motion.button>
              </Link>
            )}
          </motion.div>
        </div>

        {/* Content */}
        <Link to={`/produkt/${product.id}`} className="block">
          <div className="p-4">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors lowercase">
              {product.name}
            </h3>
            <p className="text-lg font-bold text-primary mt-1">{product.priceFormatted}</p>
            
            {/* Colors */}
            {colorCount > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <div className="flex -space-x-1">
                  {product.colors.slice(0, 3).map((color, i) => (
                    <motion.div
                      key={i}
                      className="w-4 h-4 rounded-full bg-muted border-2 border-background"
                      title={color}
                      whileHover={{ scale: 1.2 }}
                    />
                  ))}
                </div>
                {colorCount > 3 && (
                  <span className="text-sm text-muted-foreground">+{colorCount - 3}</span>
                )}
              </div>
            )}
          </div>
        </Link>
      </div>
    </motion.div>
  );
};
