import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CookieConsent } from "@/components/CookieConsent";
import Index from "./pages/Index";

const Produkte = lazy(() => import("./pages/Produkte"));
const ProduktDetail = lazy(() => import("./pages/ProduktDetail"));
const Leistungen = lazy(() => import("./pages/Leistungen"));
const Unternehmen = lazy(() => import("./pages/Unternehmen"));
const SelbstGestalten = lazy(() => import("./pages/SelbstGestalten"));
const TShirtDesigner = lazy(() => import("./pages/TShirtDesigner"));
const Grossbestellung = lazy(() => import("./pages/Grossbestellung"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const AdminPlacementZones = lazy(() => import("./pages/AdminPlacementZones"));
const Impressum = lazy(() => import("./pages/Impressum"));
const Datenschutz = lazy(() => import("./pages/Datenschutz"));
const AGB = lazy(() => import("./pages/AGB"));
const Filialen = lazy(() => import("./pages/Filialen"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <CartDrawer />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/produkte" element={<Produkte />} />
                <Route path="/produkt/:id" element={<ProduktDetail />} />
                <Route path="/leistungen" element={<Leistungen />} />
                <Route path="/unternehmen" element={<Unternehmen />} />
                <Route path="/selbst-gestalten" element={<SelbstGestalten />} />
                <Route path="/designer" element={<TShirtDesigner />} />
                <Route path="/grossbestellung" element={<Grossbestellung />} />
                <Route path="/filialen" element={<Filialen />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/checkout/success" element={<CheckoutSuccess />} />
                <Route path="/impressum" element={<Impressum />} />
                <Route path="/datenschutz" element={<Datenschutz />} />
                <Route path="/agb" element={<AGB />} />
                <Route path="/admin/placement-zones" element={<AdminPlacementZones />} />
                <Route path="/admin/placement-zones/:productId" element={<AdminPlacementZones />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <CookieConsent />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
