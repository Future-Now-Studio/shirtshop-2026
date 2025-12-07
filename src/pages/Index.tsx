import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { ShopSection } from "@/components/home/ShopSection";
import { AboutPreview } from "@/components/home/AboutPreview";
import { ContactBanner } from "@/components/home/ContactBanner";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <ShopSection />
      <AboutPreview />
      <ContactBanner />
    </Layout>
  );
};

export default Index;
