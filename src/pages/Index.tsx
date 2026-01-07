import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { ShopSection } from "@/components/home/ShopSection";
import { ProductSlider } from "@/components/home/ProductSlider";
import { AboutPreview } from "@/components/home/AboutPreview";
import { FAQSection } from "@/components/home/FAQSection";
import { LocationsSection } from "@/components/home/LocationsSection";

const Index = () => {
  const location = useLocation();

  // Handle hash scrolling when navigating to this page with a hash
  useEffect(() => {
    if (location.hash) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.querySelector(location.hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location.hash]);

  return (
    <Layout>
      <HeroSection />
      <ProductSlider />
      <ShopSection />
      <AboutPreview />
      <FAQSection />
      <LocationsSection />
    </Layout>
  );
};

export default Index;
