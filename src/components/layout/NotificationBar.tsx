import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Truck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationBarProps {
  message?: string;
  variant?: "default" | "promo" | "info";
}

export const NotificationBar = ({ 
  message = "Gratis Lieferung ab 50 Euro",
  variant = "promo"
}: NotificationBarProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if notification was dismissed
    const dismissed = localStorage.getItem("notification-bar-dismissed");
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("notification-bar-dismissed", "true");
    // Dispatch custom event to notify navbar
    window.dispatchEvent(new Event("notification-bar-dismissed"));
  };

  const variantStyles = {
    default: "bg-muted text-foreground border-border",
    promo: "bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 text-foreground border-primary/30",
    info: "bg-accent/50 text-foreground border-accent",
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`fixed top-0 left-0 right-0 z-[60] border-b ${variantStyles[variant]}`}
        >
          <div className="container-wide">
            <div className="flex items-center justify-center gap-3 py-3 px-4 relative">
              {variant === "promo" && (
                <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              )}
              {variant === "default" && (
                <Truck className="w-4 h-4 text-primary flex-shrink-0" />
              )}
              <p className="text-sm font-medium text-center flex-1">
                {message}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 absolute right-2 hover:bg-background/20"
                onClick={handleDismiss}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

