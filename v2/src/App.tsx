import { Routes, Route, Link, useLocation, useNavigationType } from "react-router-dom";
import Home from "@/pages/Home";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import OrderSuccess from "@/pages/OrderSuccess";
import Footer from "@/components/layout/Footer";
import { Unternehmen, Leistungen, Filialen, Grossbestellung, Impressum, AGB, Datenschutz, Widerruf, Versand } from "@/pages/marketing";
import Kontakt from "@/pages/Kontakt";
import Produkte from "@/pages/Produkte";
import Wunschliste from "@/pages/Wunschliste";
import SelbstGestalten from "@/pages/SelbstGestalten";
import NotFound from "@/pages/NotFound";
import SupportBubble from "@/components/layout/SupportBubble";
import CookieConsent from "@/components/CookieConsent";
import Header from "@/components/layout/Header";
import ErrorBoundary from "@/components/ErrorBoundary";
import { lazy, Suspense, useEffect } from "react";
import { setPageMeta } from "@/lib/seo";

// Heavy routes (fabric.js designer, Stripe checkout, admin) load on demand.
const Designer = lazy(() => import("@/pages/Designer"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const CheckoutReturn = lazy(() => import("@/pages/CheckoutReturn"));
const NewsletterAction = lazy(() => import("@/pages/NewsletterAction"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const Overview = lazy(() => import("@/pages/admin/Overview"));
const Colors = lazy(() => import("@/pages/admin/Colors"));
const Sizes = lazy(() => import("@/pages/admin/Sizes"));
const Products = lazy(() => import("@/pages/admin/Products"));
const ProductEditor = lazy(() => import("@/pages/admin/ProductEditor"));
const Discounts = lazy(() => import("@/pages/admin/Discounts"));
const Orders = lazy(() => import("@/pages/admin/Orders"));
const Messages = lazy(() => import("@/pages/admin/Messages"));
const Inventory = lazy(() => import("@/pages/admin/Inventory"));
const Inquiries = lazy(() => import("@/pages/admin/Inquiries"));
const Settings = lazy(() => import("@/pages/admin/Settings"));
const Coupons = lazy(() => import("@/pages/admin/Coupons"));
const AdminReviews = lazy(() => import("@/pages/admin/Reviews"));
const SetPassword = lazy(() => import("@/pages/admin/SetPassword"));
const Guide = lazy(() => import("@/pages/admin/Guide"));

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
  "/versand": "Versand & Lieferung | Private Shirt",
  "/kasse/abschluss": "Bestellabschluss | Private Shirt",
  "/newsletter/bestaetigen": "Newsletter bestätigen | Private Shirt",
  "/newsletter/abmelden": "Newsletter abmelden | Private Shirt",
};

// Private pages (cart, checkout, order, newsletter links, admin) are never indexed.
const NOINDEX = ["/warenkorb", "/wunschliste", "/kasse", "/bestellung/", "/newsletter/", "/admin"];

const DESCRIPTIONS: Record<string, string> = {
  "/": "T-Shirts, Hoodies und mehr selbst gestalten und in Hamburg bedrucken lassen – online oder in unseren Filialen.",
  "/produkte": "Alle Textilien zum Bedrucken: T-Shirts, Hoodies, Polos und mehr – gestalte dein Lieblingsstück.",
  "/selbst-gestalten": "Gestalte dein Shirt direkt im Browser: Text, Logo oder Foto platzieren und bestellen.",
  "/leistungen": "Siebdruck, Digitaldruck, Flex, Flock und Stick – unsere Druckverfahren im Überblick.",
  "/unternehmen": "Private Shirt: Textilveredelung aus Hamburg seit 2010.",
  "/filialen": "Besuch uns in Hamburg: Europa Passage und Mercado Altona.",
  "/grossbestellung": "Großbestellungen für Firmen, Vereine und Events – individuelles Angebot anfragen.",
  "/kontakt": "Fragen, Sonderwünsche oder Großbestellung? Schreib uns.",
  "/versand": "Versandkosten, Lieferzeit und Liefergebiet von Private Shirt.",
};

export default function App() {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    // new page → start at the top; back/forward keeps the browser's position, #anchors scroll themselves
    if (navType !== "POP" && !hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, navType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // product and designer pages set their own meta once the product loaded
    if (pathname.startsWith("/produkt/") || pathname.startsWith("/gestalten/")) return;
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    const title = TITLES[path]
      ?? (path.startsWith("/admin") ? "Admin | Private Shirt" : path.startsWith("/bestellung/") ? "Bestellung | Private Shirt" : null);
    if (!title) return; // unknown URL: <NotFound /> sets its own meta (noindex)
    setPageMeta({ title, description: DESCRIPTIONS[path], path, noindex: NOINDEX.some((p) => path.startsWith(p)) });
  }, [pathname]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Header />
      <main className="container py-10">
        <ErrorBoundary key={pathname}>
        <Suspense fallback={<p className="text-muted-foreground">Lade…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/produkte" element={<Produkte />} />
          <Route path="/wunschliste" element={<Wunschliste />} />
          <Route path="/selbst-gestalten" element={<SelbstGestalten />} />
          <Route path="/produkt/:slug" element={<ProductDetail />} />
          <Route path="/gestalten/:slug" element={<Designer />} />
          <Route path="/warenkorb" element={<Cart />} />
          <Route path="/kasse" element={<Checkout />} />
          <Route path="/kasse/abschluss" element={<CheckoutReturn />} />
          <Route path="/newsletter/bestaetigen" element={<NewsletterAction action="confirm" />} />
          <Route path="/newsletter/abmelden" element={<NewsletterAction action="unsubscribe" />} />
          <Route path="/bestellung/:orderId" element={<OrderSuccess />} />
          <Route path="/unternehmen" element={<Unternehmen />} />
          <Route path="/leistungen" element={<Leistungen />} />
          <Route path="/filialen" element={<Filialen />} />
          <Route path="/grossbestellung" element={<Grossbestellung />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/agb" element={<AGB />} />
          <Route path="/datenschutz" element={<Datenschutz />} />
          <Route path="/widerruf" element={<Widerruf />} />
          <Route path="/versand" element={<Versand />} />
          <Route path="/kontakt" element={<Kontakt />} />
          <Route path="/admin/passwort-setzen" element={<SetPassword />} />
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
            <Route path="anleitung" element={<Guide />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <SupportBubble />
      <CookieConsent />
    </div>
  );
}
