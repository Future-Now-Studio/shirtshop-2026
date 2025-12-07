import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Upload, Palette, Package, Truck } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

const steps = [
  { icon: Package, title: "1. Produkt wählen", description: "Wähle aus unserer großen Auswahl an Textilien" },
  { icon: Upload, title: "2. Design hochladen", description: "Lade dein eigenes Design oder Logo hoch" },
  { icon: Palette, title: "3. Gestalten", description: "Passe Farben, Position und Größe an" },
  { icon: Truck, title: "4. Bestellen", description: "Erhalte deine Produkte in wenigen Tagen" },
];

const SelbstGestalten = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 gradient-bg" />
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Design"
            className="w-full h-full object-cover opacity-30 mix-blend-overlay"
          />
        </div>

        <div className="container-wide relative z-10 text-center py-20">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-7xl font-bold mb-6"
          >
            <span className="text-primary-foreground">selbst</span>
            <br />
            <span className="text-secondary">gestalten.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto"
          >
            Erstelle dein einzigartiges Design in wenigen Schritten. 
            Einfach, schnell und professionell.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button variant="hero" size="xl" className="group">
              Designer starten
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl lg:text-5xl font-bold text-center text-primary mb-16"
          >
            So einfach geht's
          </motion.h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto bg-accent rounded-2xl flex items-center justify-center mb-6 relative">
                  <step.icon className="w-10 h-10 text-primary" />
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute -right-12 top-1/2 w-8 h-0.5 bg-border" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-muted/30">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 text-center"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-4">
              Bereit für dein eigenes Design?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Starte jetzt mit unserem intuitiven Designer und erstelle 
              einzigartige Textilien für dich oder dein Team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" className="group">
                Jetzt loslegen
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Link to="/produkte">
                <Button variant="outline" size="xl">
                  Produkte ansehen
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default SelbstGestalten;
