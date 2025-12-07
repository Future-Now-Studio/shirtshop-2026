import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { ShopSection } from "@/components/home/ShopSection";
import { ProductSlider } from "@/components/home/ProductSlider";
import { AboutPreview } from "@/components/home/AboutPreview";
import { FAQSection } from "@/components/home/FAQSection";
import { ContactBanner } from "@/components/home/ContactBanner";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <ProductSlider />

      <ShopSection />
      <AboutPreview />
      <FAQSection />
      <ContactBanner />
    </Layout>
  );
};

export default Index;
