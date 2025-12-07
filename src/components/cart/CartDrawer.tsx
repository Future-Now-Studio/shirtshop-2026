import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, ShoppingBag, Trash2, Truck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCartStore } from "@/stores/cartStore";
import { Link } from "react-router-dom";

const FREE_SHIPPING_THRESHOLD = 50; // Minimum order value for free shipping in EUR
const SHIPPING_COST = 4.95; // Standard shipping cost in EUR

export const CartDrawer = () => {
  const { items, isOpen, closeCart, updateQuantity, removeItem, getTotalPrice, getItemPrice } = useCartStore();
  
  const subtotal = getTotalPrice();
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const hasFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shippingCost = hasFreeShipping ? 0 : SHIPPING_COST;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-background shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">Warenkorb</h2>
                <span className="bg-primary text-primary-foreground text-sm px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={closeCart}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Dein Warenkorb ist leer
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Füge Produkte hinzu, um loszulegen
                  </p>
                  <Button onClick={closeCart} asChild>
                    <Link to="/produkte">Produkte entdecken</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 100 }}
                      className="flex gap-4 p-4 bg-muted/30 rounded-xl"
                    >
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-background flex-shrink-0">
                        <img
                          src={item.customDesign || item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {item.color} / {item.size}
                        </p>
                        {item.customDesign && (
                          <span className="text-xs text-primary font-medium">
                            + Eigenes Design
                          </span>
                        )}
                        <p className="font-bold text-primary mt-1">
                          {getItemPrice(item).toFixed(2).replace(".", ",")} €
                          {item.designElementCount && item.designElementCount > 0 && (
                            <span className="text-xs text-muted-foreground block font-normal">
                              {item.price.toFixed(2).replace(".", ",")} € + {item.designElementCount} Element{item.designElementCount !== 1 ? 'e' : ''} × 10 €
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <div className="flex items-center gap-1 bg-background rounded-full p-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-6 border-t border-border space-y-4">
                {/* Free Shipping Progress */}
                {!hasFreeShipping ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-4 border border-primary/20"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">
                        {remainingForFreeShipping > 0
                          ? `Noch ${remainingForFreeShipping.toFixed(2).replace(".", ",")} € für kostenlosen Versand!`
                          : "Kostenloser Versand!"}
                      </p>
                    </div>
                    <Progress value={progress} className="h-2 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {subtotal.toFixed(2).replace(".", ",")} € von {FREE_SHIPPING_THRESHOLD.toFixed(2).replace(".", ",")} €
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl p-4 border-2 border-primary/40"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <p className="text-sm font-bold text-primary">
                        🎉 Kostenloser Versand freigeschaltet!
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Price Summary */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Zwischensumme</span>
                    <span className="font-semibold">
                      {subtotal.toFixed(2).replace(".", ",")} €
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Versand
                      {hasFreeShipping && (
                        <span className="text-primary font-semibold ml-1">(kostenlos)</span>
                      )}
                    </span>
                    <span className={`font-semibold ${hasFreeShipping ? "text-primary line-through text-muted-foreground" : ""}`}>
                      {shippingCost.toFixed(2).replace(".", ",")} €
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-lg font-bold">Gesamt</span>
                    <span className="text-2xl font-bold text-primary">
                      {(subtotal + shippingCost).toFixed(2).replace(".", ",")} €
                    </span>
                  </div>
                </div>

                <Button size="lg" className="w-full" asChild onClick={closeCart}>
                  <Link to="/checkout">Zur Kasse</Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full" onClick={closeCart}>
                  Weiter einkaufen
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
