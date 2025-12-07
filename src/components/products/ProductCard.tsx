import { motion } from "framer-motion";
import { ShoppingBag, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Product {
  id: number;
  name: string;
  price: string;
  image: string;
  colors: number;
  category: string;
}

interface ProductCardProps {
  product: Product;
  index: number;
}

export const ProductCard = ({ product, index }: ProductCardProps) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group glass-card overflow-hidden hover-lift"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-2">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-lg"
            >
              <ShoppingBag className="w-5 h-5 text-primary" />
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-lg"
            >
              <Palette className="w-5 h-5 text-primary" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors lowercase">
          {product.name}
        </h3>
        <p className="text-lg font-bold text-primary mt-1">{product.price}</p>
        
        {/* Colors */}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex -space-x-1">
            {["bg-background border", "bg-foreground", "bg-primary", "bg-secondary"].slice(0, 3).map((color, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full ${color} border-2 border-background`}
              />
            ))}
          </div>
          {product.colors > 3 && (
            <span className="text-sm text-muted-foreground">+{product.colors - 3}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
