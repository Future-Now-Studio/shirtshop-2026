import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-image.jpg";

export const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 gradient-bg opacity-90" />
      
      {/* Hero image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Fashion hero"
          className="w-full h-full object-cover opacity-40 mix-blend-overlay"
        />
      </div>

      {/* Content */}
      <div className="container-wide relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
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
              <span className="text-primary-foreground">sei du selbst.</span>
              <br />
              <span className="text-secondary">sei einzigartig.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg sm:text-xl text-primary-foreground/80 mb-8 max-w-lg mx-auto lg:mx-0"
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
                <Button variant="hero" size="xl" className="group">
                  selbst gestalten
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/produkte">
                <Button variant="glass" size="xl">
                  produkte entdecken
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Floating decorative elements */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="hidden lg:block relative"
          >
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-secondary/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary-foreground/10 rounded-full blur-2xl" />
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 border-2 border-primary-foreground/30 rounded-full flex justify-center pt-2"
        >
          <div className="w-1.5 h-3 bg-primary-foreground/50 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
};
