import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, Truck, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-image.jpg";
import heroVideo from "@/assets/browsing.mp4";
import { useIsMobile } from "@/hooks/use-mobile";

const trustElements = [
  { icon: CheckCircle, text: "Über 10.000 zufriedene Bestellungen" },
  { icon: Factory, text: "Lokale Produktion" },
  { icon: Truck, text: "Schnelle Lieferung" },
];

export const HeroSection = () => {
  const isMobile = useIsMobile();
  
  return (
    <section className="relative h-[100vh] flex flex-col overflow-hidden -mt-24">
      {/* Full-width video background */}
      <div className="absolute inset-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src={heroVideo} type="video/mp4" />
          <img
            src={heroImage}
            alt="Fashion hero"
            className="w-full h-full object-cover"
          />
        </video>
      </div>

      {/* Dark gradient on left side for text readability */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to right, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.4) 40%, rgba(0, 0, 0, 0.2) 60%, transparent 100%)'
        }}
      />

      {/* Content overlay - with bottom padding to account for trust bar */}
      <div className="container-wide relative z-10 w-full flex-1 flex items-center pb-24 md:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center w-full py-8 lg:py-12">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black leading-[0.9] mb-6"
            >
              <span className="text-primary">sei du selbst.</span>
              <br />
              <span className="text-secondary">sei einzigartig.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg sm:text-xl text-primary-foreground/90 mb-8 max-w-lg mx-auto lg:mx-0"
            >
              gestalte ganz frei deinen look. t-shirts, sweatshirts, hoodies und vieles mehr. probier's einfach!
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Link to="/selbst-gestalten">
                <Button variant="hero" size="xl" className="group !bg-white !text-foreground hover:!bg-white/90 !shadow-lg hover:!shadow-xl">
                  selbst gestalten
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/produkte">
                <Button variant="glass" size="xl" className="!bg-white/20 !backdrop-blur-md !border-2 !border-white/50 !text-white hover:!bg-white/30 !shadow-lg">
                  produkte entdecken
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Trust Bar - Overlay at bottom of video */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-background/85 backdrop-blur-md border-t border-border/30">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-6 md:py-8">
            {trustElements.map((element, index) => {
              const Icon = element.icon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-4 justify-center"
                >
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{element.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-20"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`w-6 h-10 border-2 rounded-full flex justify-center pt-2 ${
            isMobile 
              ? "border-primary-foreground/30" 
              : "border-foreground/30"
          }`}
        >
          <div className={`w-1.5 h-3 rounded-full ${
            isMobile 
              ? "bg-primary-foreground/50" 
              : "bg-foreground/50"
          }`} />
        </motion.div>
      </motion.div>
    </section>
  );
};
