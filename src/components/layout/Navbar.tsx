import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ShoppingBag, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cartStore";
import logo from "@/assets/group-25.svg";

const navLinks = [
  { name: "Filialen", path: "/filialen" },
  { name: "Unternehmen", path: "/unternehmen" },
  { name: "Leistungen", path: "/leistungen" },
  { name: "Produkte", path: "/produkte" },
  { name: "Großbestellung", path: "/grossbestellung" },
  { name: "Selbst gestalten", path: "/selbst-gestalten" },
];

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNotificationBar, setHasNotificationBar] = useState(false);
  const location = useLocation();
  const { openCart, getTotalItems } = useCartStore();
  const totalItems = getTotalItems();

  // Check if notification bar is visible
  useEffect(() => {
    const checkNotificationBar = () => {
      const dismissed = localStorage.getItem("notification-bar-dismissed");
      setHasNotificationBar(!dismissed);
    };
    checkNotificationBar();
    // Listen for custom event when notification is dismissed
    window.addEventListener("notification-bar-dismissed", checkNotificationBar);
    // Also listen for storage changes (for cross-tab sync)
    window.addEventListener("storage", checkNotificationBar);
    return () => {
      window.removeEventListener("notification-bar-dismissed", checkNotificationBar);
      window.removeEventListener("storage", checkNotificationBar);
    };
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed left-0 right-0 z-50 glass-nav"
      style={{ top: hasNotificationBar ? "44px" : "0px" }}
    >
      <nav className="container-wide">
        <div className="flex items-center justify-between h-24">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <motion.img
              src={logo}
              alt="Private Shirt Logo"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="h-12 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link key={link.path} to={link.path}>
                <Button
                  variant="nav"
                  className={`relative text-base px-5 py-2 ${
                    location.pathname === link.path ? "text-primary" : ""
                  }`}
                >
                  {link.name}
                  {location.pathname === link.path && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full"
                    />
                  )}
                </Button>
              </Link>
            ))}
          </div>

          {/* Right Icons */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-11 w-11">
                <User className="w-6 h-6" />
              </Button>
              <Button variant="ghost" size="icon" className="h-11 w-11">
                <MapPin className="w-6 h-6" />
              </Button>
              <Button variant="ghost" size="icon" className="relative h-11 w-11" onClick={openCart}>
                <ShoppingBag className="w-6 h-6" />
                <motion.span
                  key={totalItems}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-primary text-primary-foreground text-sm font-bold rounded-full flex items-center justify-center"
                >
                  {totalItems}
                </motion.span>
              </Button>
            </div>

            {/* Mobile Cart */}
            <Button variant="ghost" size="icon" className="relative md:hidden h-11 w-11" onClick={openCart}>
              <ShoppingBag className="w-6 h-6" />
              <motion.span
                key={totalItems}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-6 h-6 bg-primary text-primary-foreground text-sm font-bold rounded-full flex items-center justify-center"
              >
                {totalItems}
              </motion.span>
            </Button>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-11 w-11"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden bg-background border-t border-border"
          >
            <div className="container-wide py-6 flex flex-col gap-2">
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={`block py-4 px-5 rounded-xl font-medium text-base transition-colors ${
                      location.pathname === link.path
                        ? "bg-accent text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}
              <div className="flex gap-2 pt-4 border-t border-border mt-4">
                <Button variant="ghost" size="icon">
                  <User className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MapPin className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};
