import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Produkte from "./pages/Produkte";
import Leistungen from "./pages/Leistungen";
import Unternehmen from "./pages/Unternehmen";
import SelbstGestalten from "./pages/SelbstGestalten";
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
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/produkte" element={<Produkte />} />
          <Route path="/leistungen" element={<Leistungen />} />
          <Route path="/unternehmen" element={<Unternehmen />} />
          <Route path="/selbst-gestalten" element={<SelbstGestalten />} />
          <Route path="/grossbestellung" element={<Grossbestellung />} />
          <Route path="/filialen" element={<Filialen />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
