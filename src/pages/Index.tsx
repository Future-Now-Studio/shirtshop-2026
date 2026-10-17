import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Seo, localBusinessJsonLd } from "@/components/Seo";
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
      <Seo
        title="Private Shirt | Sei du selbst. Sei einzigartig."
        description="Professionelle Textilveredelung aus Hamburg. T-Shirts, Hoodies, Sweatshirts individuell gestalten. Druck & Stickerei ab einem Stück."
        canonical="/"
        jsonLd={localBusinessJsonLd}
      />
      <HeroSection />
      {/* TEMP: ProductSlider + ShopSection hidden until product catalog is ready */}
      {/* <ProductSlider /> */}
      {/* <ShopSection /> */}
      <AboutPreview />
      <FAQSection />
      <LocationsSection />
    </Layout>
  );
};

export default Index;
