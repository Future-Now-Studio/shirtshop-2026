import { motion } from "framer-motion";
import { Mail, Phone, Clock } from "lucide-react";

export const ContactBanner = () => {
  return (
    <section className="section-padding bg-accent/50">
      <div className="container-wide">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-8 lg:p-12 rounded-3xl"
        >
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl lg:text-3xl font-bold text-primary mb-4">
                online only
              </h3>
              <p className="text-muted-foreground mb-6">
                Leider sind aktuell unsere Filialen geschlossen. Eure Online-Bestellungen 
                bearbeiten wir natürlich schnellstmöglich.
              </p>
              <p className="text-lg font-semibold text-foreground">
                Bitte bleibt alle gesund!
                <br />
                <span className="text-primary">Euer Private Shirt Team</span>
              </p>
            </div>

            <div className="space-y-4">
              <motion.a
                href="mailto:info@private-shirt.de"
                whileHover={{ scale: 1.02 }}
                className="flex items-center gap-4 p-4 bg-background rounded-xl hover:shadow-soft transition-all"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">E-Mail</p>
                  <p className="font-semibold">info@private-shirt.de</p>
                </div>
              </motion.a>

              <motion.a
                href="tel:040-18075863"
                whileHover={{ scale: 1.02 }}
                className="flex items-center gap-4 p-4 bg-background rounded-xl hover:shadow-soft transition-all"
              >
                <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center">
                  <Phone className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefon Hotline</p>
                  <p className="font-semibold">040 - 180 75 863</p>
                </div>
              </motion.a>

              <div className="flex items-center gap-4 p-4 bg-background rounded-xl">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Erreichbarkeit</p>
                  <p className="font-semibold">Mo - Fr: 9:00 - 18:00 Uhr</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
