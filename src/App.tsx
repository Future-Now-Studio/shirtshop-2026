import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartDrawer } from "@/components/cart/CartDrawer";
import Index from "./pages/Index";
import Produkte from "./pages/Produkte";
import ProduktDetail from "./pages/ProduktDetail";
import Leistungen from "./pages/Leistungen";
import Unternehmen from "./pages/Unternehmen";
import SelbstGestalten from "./pages/SelbstGestalten";
import TShirtDesigner from "./pages/TShirtDesigner";
import Grossbestellung from "./pages/Grossbestellung";
import Filialen from "./pages/Filialen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CartDrawer />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
