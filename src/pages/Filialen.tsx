import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { MapPin, Clock, Phone, Mail } from "lucide-react";

const locations = [
  {
    name: "Hamburg Altona",
    address: "Ottenser Hauptstraße 10",
    city: "22765 Hamburg",
    phone: "040 - 180 75 863",
    hours: "Mo - Fr: 10:00 - 18:00",
    status: "closed",
  },
  {
    name: "Hamburg City",
    address: "Mönckebergstraße 25",
    city: "20095 Hamburg",
    phone: "040 - 180 75 864",
    hours: "Mo - Sa: 10:00 - 20:00",
    status: "closed",
  },
  {
    name: "Hamburg Wandsbek",
    address: "Wandsbeker Marktstraße 50",
    city: "22041 Hamburg",
    phone: "040 - 180 75 865",
    hours: "Mo - Fr: 10:00 - 18:00",
    status: "closed",
  },
];

const Filialen = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="pt-12 pb-8 bg-gradient-to-b from-accent/30 to-background">
        <div className="container-wide">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-6xl font-bold text-primary mb-4"
          >
            unsere <span className="text-secondary italic">filialen.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl"
          >
            Besuche uns in einer unserer Filialen in Hamburg
          </motion.p>
        </div>
      </section>

      {/* Notice */}
      <section className="py-8">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-secondary/20 border border-secondary/30 rounded-2xl p-6 text-center"
          >
            <p className="text-lg font-semibold text-foreground">
              ⚠️ Aktuell sind unsere Filialen geschlossen. Online-Bestellungen werden weiterhin bearbeitet.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Locations */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {locations.map((location, index) => (
              <motion.div
                key={location.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-8 relative overflow-hidden"
              >
                {location.status === "closed" && (
                  <div className="absolute top-4 right-4 bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1 rounded-full">
                    Geschlossen
                  </div>
                )}
                
                <h3 className="text-2xl font-bold text-primary mb-6">{location.name}</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-primary mt-1" />
                    <div>
                      <p className="font-medium">{location.address}</p>
                      <p className="text-muted-foreground">{location.city}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-primary" />
                    <a href={`tel:${location.phone}`} className="hover:text-primary transition-colors">
                      {location.phone}
                    </a>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">{location.hours}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Alternative */}
      <section className="section-padding bg-muted/30">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto"
          >
            <h2 className="text-3xl font-bold text-primary mb-4">Online erreichbar</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Auch wenn unsere Filialen geschlossen sind, sind wir online für Sie da!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:info@private-shirt.de"
                className="flex items-center justify-center gap-2 glass-card p-4 hover:shadow-soft transition-all"
              >
                <Mail className="w-5 h-5 text-primary" />
                <span className="font-medium">info@private-shirt.de</span>
              </a>
              <a
                href="tel:040-18075863"
                className="flex items-center justify-center gap-2 glass-card p-4 hover:shadow-soft transition-all"
              >
                <Phone className="w-5 h-5 text-primary" />
                <span className="font-medium">040 - 180 75 863</span>
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Filialen;
