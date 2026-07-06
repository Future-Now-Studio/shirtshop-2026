import { Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "@/pages/Home";
import ProductDetail from "@/pages/ProductDetail";
import Designer from "@/pages/Designer";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import OrderSuccess from "@/pages/OrderSuccess";
import Footer from "@/components/layout/Footer";
import { Unternehmen, Leistungen, Filialen, Grossbestellung, Impressum, AGB, Datenschutz } from "@/pages/marketing";
import Kontakt from "@/pages/Kontakt";
import Produkte from "@/pages/Produkte";
import SelbstGestalten from "@/pages/SelbstGestalten";
import NotFound from "@/pages/NotFound";
import SupportBubble from "@/components/layout/SupportBubble";
import { useEffect } from "react";
import { useCart } from "@/stores/cart";
import { ShoppingBag } from "lucide-react";
import logo from "@/assets/group-25.svg";
import AdminLayout from "@/pages/admin/AdminLayout";
import Overview from "@/pages/admin/Overview";
import Colors from "@/pages/admin/Colors";
import Sizes from "@/pages/admin/Sizes";
import Products from "@/pages/admin/Products";
import ProductEditor from "@/pages/admin/ProductEditor";
import Discounts from "@/pages/admin/Discounts";
import Orders from "@/pages/admin/Orders";
import Messages from "@/pages/admin/Messages";

function CartLink() {
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  return (
    <Link to="/warenkorb" className="relative flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary">
      <ShoppingBag className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-bold text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}

const TITLES: Record<string, string> = {
  "/": "Private Shirt | Sei du selbst. Sei einzigartig.",
  "/produkte": "Produkte | Private Shirt",
  "/selbst-gestalten": "Selbst gestalten | Private Shirt",
  "/leistungen": "Leistungen | Private Shirt",
  "/unternehmen": "Über uns | Private Shirt",
  "/filialen": "Filialen | Private Shirt",
  "/grossbestellung": "Großbestellung | Private Shirt",
  "/kontakt": "Kontakt | Private Shirt",
  "/warenkorb": "Warenkorb | Private Shirt",
  "/kasse": "Kasse | Private Shirt",
  "/impressum": "Impressum | Private Shirt",
  "/agb": "AGB | Private Shirt",
  "/datenschutz": "Datenschutz | Private Shirt",
};

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] ?? (pathname.startsWith("/admin") ? "Admin | Private Shirt" : "Private Shirt");
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <header className="glass-nav sticky top-0 z-40">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Private Shirt" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium lowercase">
            <Link to="/selbst-gestalten" className="hidden text-muted-foreground transition-colors hover:text-primary md:inline">selbst gestalten</Link>
            <Link to="/filialen" className="hidden text-muted-foreground transition-colors hover:text-primary lg:inline">filialen</Link>
            <Link to="/unternehmen" className="hidden text-muted-foreground transition-colors hover:text-primary lg:inline">über uns</Link>
            <Link to="/leistungen" className="hidden text-muted-foreground transition-colors hover:text-primary lg:inline">leistungen</Link>
            <Link to="/grossbestellung" className="hidden text-muted-foreground transition-colors hover:text-primary md:inline">großbestellung</Link>
            <Link to="/kontakt" className="hidden text-muted-foreground transition-colors hover:text-primary md:inline">kontakt</Link>
            <CartLink />
            <Link to="/admin" className="text-muted-foreground transition-colors hover:text-primary">admin</Link>
          </nav>
        </div>
      </header>
      <main className="container py-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/produkte" element={<Produkte />} />
          <Route path="/selbst-gestalten" element={<SelbstGestalten />} />
          <Route path="/produkt/:slug" element={<ProductDetail />} />
          <Route path="/gestalten/:slug" element={<Designer />} />
          <Route path="/warenkorb" element={<Cart />} />
          <Route path="/kasse" element={<Checkout />} />
          <Route path="/bestellung/:orderId" element={<OrderSuccess />} />
          <Route path="/unternehmen" element={<Unternehmen />} />
          <Route path="/leistungen" element={<Leistungen />} />
          <Route path="/filialen" element={<Filialen />} />
          <Route path="/grossbestellung" element={<Grossbestellung />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/agb" element={<AGB />} />
          <Route path="/datenschutz" element={<Datenschutz />} />
          <Route path="/kontakt" element={<Kontakt />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Overview />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:id" element={<ProductEditor />} />
            <Route path="colors" element={<Colors />} />
            <Route path="sizes" element={<Sizes />} />
            <Route path="orders" element={<Orders />} />
            <Route path="discounts" element={<Discounts />} />
            <Route path="messages" element={<Messages />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <SupportBubble />
    </div>
  );
}
