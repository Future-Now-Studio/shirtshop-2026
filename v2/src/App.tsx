import { Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "@/pages/Home";
import ProductDetail from "@/pages/ProductDetail";
import Designer from "@/pages/Designer";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import OrderSuccess from "@/pages/OrderSuccess";
import Footer from "@/components/layout/Footer";
import { Unternehmen, Leistungen, Filialen, Grossbestellung, Impressum, AGB, Datenschutz, Widerruf } from "@/pages/marketing";
import Kontakt from "@/pages/Kontakt";
import Produkte from "@/pages/Produkte";
import Wunschliste from "@/pages/Wunschliste";
import SelbstGestalten from "@/pages/SelbstGestalten";
import NotFound from "@/pages/NotFound";
import SupportBubble from "@/components/layout/SupportBubble";
import CookieConsent from "@/components/CookieConsent";
import Header from "@/components/layout/Header";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useEffect } from "react";
import AdminLayout from "@/pages/admin/AdminLayout";
import Overview from "@/pages/admin/Overview";
import Colors from "@/pages/admin/Colors";
import Sizes from "@/pages/admin/Sizes";
import Products from "@/pages/admin/Products";
import ProductEditor from "@/pages/admin/ProductEditor";
import Discounts from "@/pages/admin/Discounts";
import Orders from "@/pages/admin/Orders";
import Messages from "@/pages/admin/Messages";
import Inventory from "@/pages/admin/Inventory";
import Inquiries from "@/pages/admin/Inquiries";
import Settings from "@/pages/admin/Settings";
import Coupons from "@/pages/admin/Coupons";
import AdminReviews from "@/pages/admin/Reviews";

const TITLES: Record<string, string> = {
  "/": "Private Shirt | Sei du selbst. Sei einzigartig.",
  "/produkte": "Produkte | Private Shirt",
  "/wunschliste": "Merkliste | Private Shirt",
  "/widerruf": "Widerrufsrecht | Private Shirt",
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
    <div className="min-h-screen overflow-x-hidden">
      <Header />
      <main className="container py-10">
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/produkte" element={<Produkte />} />
          <Route path="/wunschliste" element={<Wunschliste />} />
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
          <Route path="/widerruf" element={<Widerruf />} />
          <Route path="/kontakt" element={<Kontakt />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Overview />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:id" element={<ProductEditor />} />
            <Route path="colors" element={<Colors />} />
            <Route path="sizes" element={<Sizes />} />
            <Route path="orders" element={<Orders />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="inquiries" element={<Inquiries />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="settings" element={<Settings />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="discounts" element={<Discounts />} />
            <Route path="messages" element={<Messages />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
      <SupportBubble />
      <CookieConsent />
    </div>
  );
}
