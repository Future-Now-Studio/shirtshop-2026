import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Check, Users, Percent, Truck, HeadphonesIcon } from "lucide-react";

const benefits = [
  { icon: Users, title: "Ab 25 Stück", description: "Mengenrabatte schon ab kleinen Auflagen" },
  { icon: Percent, title: "Bis 50% sparen", description: "Günstigere Stückpreise bei größeren Mengen" },
  { icon: Truck, title: "Express möglich", description: "Schnelle Lieferung auf Anfrage" },
  { icon: HeadphonesIcon, title: "Persönliche Beratung", description: "Ihr Ansprechpartner für alle Fragen" },
];

const Grossbestellung = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-12 pb-20 bg-gradient-to-b from-accent/50 to-background">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl lg:text-6xl font-bold mb-6">
                <span className="text-primary">du brauchst</span>
                <br />
                <span className="text-secondary italic">masse?</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Großbestellungen mit attraktiven Mengenrabatten. Ob für Ihr Unternehmen, 
                Verein oder Event – wir bieten Ihnen maßgeschneiderte Lösungen für jede Auflage.
              </p>

              <div className="space-y-3">
                {["Kostenlose Beratung", "Individuelle Angebote", "Kein Mindestbestellwert"].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    <span className="font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="glass-card p-8"
            >
              <h2 className="text-2xl font-bold text-primary mb-6">Angebot anfordern</h2>
              <form className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input placeholder="Vorname *" className="h-12" />
                  <Input placeholder="Nachname *" className="h-12" />
                </div>
                <Input type="email" placeholder="E-Mail *" className="h-12" />
                <Input placeholder="Unternehmen" className="h-12" />
                <Input placeholder="Gewünschte Stückzahl *" className="h-12" />
                <textarea
                  placeholder="Ihre Nachricht..."
                  className="w-full h-32 p-4 rounded-xl border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button type="submit" size="lg" className="w-full group">
                  Anfrage senden
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-padding">
        <div className="container-wide">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl lg:text-4xl font-bold text-center text-primary mb-12"
          >
            Ihre Vorteile bei Großbestellungen
          </motion.h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6 text-center hover-lift"
              >
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <benefit.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Grossbestellung;
