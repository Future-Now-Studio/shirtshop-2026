import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { ShopSection } from "@/components/home/ShopSection";
import { ProductSlider } from "@/components/home/ProductSlider";
import { AboutPreview } from "@/components/home/AboutPreview";
import { FAQSection } from "@/components/home/FAQSection";
import { LocationsSection } from "@/components/home/LocationsSection";

const Index = () => {
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
