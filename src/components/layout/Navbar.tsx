import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ShoppingBag, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cartStore";
import logo from "@/assets/group-25.svg";

const navLinks = [
  { name: "produkte", path: "/produkte" },
  { name: "selbst gestalten", path: "/selbst-gestalten" },
  { name: "filialen", path: "/#filialen" },
  { name: "über uns", path: "/unternehmen" },
  { name: "leistungen", path: "/leistungen" },
  { name: "großbestellung", path: "/grossbestellung" },
];

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { openCart, getTotalItems } = useCartStore();
  const totalItems = getTotalItems();

  const handleOpenChat = () => {
    window.dispatchEvent(new CustomEvent('open-chat'));
    };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed left-0 right-0 z-50 glass-nav"
      style={{ top: "0px" }}
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
            {navLinks.map((link) => {
              const isAnchor = link.path.startsWith('/#');
              const isActive = isAnchor
                ? location.pathname === '/' && location.hash === link.path.substring(1)
                : location.pathname === link.path;
              
              const handleClick = (e: React.MouseEvent) => {
                if (isAnchor) {
                  e.preventDefault();
                  const hash = link.path.substring(1); // Remove the '/'
                  if (location.pathname !== '/') {
                    // Navigate to home first, then scroll after navigation
                    navigate('/');
                    // Wait for navigation to complete, then scroll
                    setTimeout(() => {
                      const element = document.querySelector(hash);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 100);
                  } else {
                    // Already on home page, just scroll
                    const element = document.querySelector(hash);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }
                }
              };
              
              return (
                <Link key={link.path} to={link.path} onClick={handleClick}>
                <Button
                  variant="nav"
                  className={`relative text-base px-5 py-2 ${
                      isActive ? "text-primary" : ""
                  }`}
                >
                  {link.name}
                    {isActive && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full"
                    />
                  )}
                </Button>
              </Link>
              );
            })}
            <Button
              variant="nav"
              onClick={handleOpenChat}
              className="text-base px-5 py-2"
            >
              kontakt
            </Button>
          </div>

          {/* Right Icons */}
          <div className="flex items-center gap-3">
            {/* Desktop Cart */}
            <Button 
              variant="outline" 
              size="icon" 
              className="hidden md:flex relative h-12 w-12 border-2 hover:bg-accent hover:text-primary" 
              onClick={openCart}
            >
              <ShoppingBag className="w-7 h-7" />
              {totalItems > 0 && (
                <motion.span
                  key={totalItems}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-primary text-primary-foreground text-sm font-bold rounded-full flex items-center justify-center shadow-lg"
                >
                  {totalItems}
                </motion.span>
              )}
              </Button>

            {/* Mobile Cart */}
            <Button 
              variant="outline" 
              size="icon" 
              className="relative md:hidden h-12 w-12 border-2 hover:bg-accent hover:text-primary" 
              onClick={openCart}
            >
              <ShoppingBag className="w-7 h-7" />
              {totalItems > 0 && (
              <motion.span
                key={totalItems}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-primary text-primary-foreground text-sm font-bold rounded-full flex items-center justify-center shadow-lg"
              >
                {totalItems}
              </motion.span>
              )}
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
              {navLinks.map((link, index) => {
                const isAnchor = link.path.startsWith('/#');
                const isActive = isAnchor
                  ? location.pathname === '/' && location.hash === link.path.substring(1)
                  : location.pathname === link.path;
                
                const handleClick = (e: React.MouseEvent) => {
                  setIsOpen(false);
                  if (isAnchor) {
                    e.preventDefault();
                    const hash = link.path.substring(1); // Remove the '/'
                    if (location.pathname !== '/') {
                      // Navigate to home first, then scroll after navigation
                      navigate('/');
                      // Wait for navigation to complete, then scroll
                      setTimeout(() => {
                        const element = document.querySelector(hash);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }, 100);
                    } else {
                      // Already on home page, just scroll
                      const element = document.querySelector(hash);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }
                  }
                };
                
                return (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    to={link.path}
                      onClick={handleClick}
                    className={`block py-4 px-5 rounded-xl font-medium text-base transition-colors ${
                        isActive
                        ? "bg-accent text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {link.name}
                  </Link>
                </motion.div>
                );
              })}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: navLinks.length * 0.05 }}
              >
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleOpenChat();
                  }}
                  className="w-full py-4 px-5 rounded-xl font-medium text-base transition-colors hover:bg-muted text-left"
                >
                  kontakt
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};
