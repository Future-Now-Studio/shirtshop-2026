import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { getProductById } from "@/data/products";
import { useCartStore } from "@/stores/cartStore";
import { ShoppingBag, Check, ArrowLeft, Palette } from "lucide-react";
import { toast } from "sonner";

const ProduktDetail = () => {
  const { id } = useParams<{ id: string }>();
  const product = getProductById(Number(id));
  const addItem = useCartStore((state) => state.addItem);

  const [selectedColor, setSelectedColor] = useState(product?.colors[0] || "");
  const [selectedSize, setSelectedSize] = useState("");

  if (!product) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Produkt nicht gefunden</h1>
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
      image: product.image,
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
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <div className="aspect-square rounded-3xl overflow-hidden bg-muted">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
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
              <Link to="/selbst-gestalten" className="flex-1">
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
