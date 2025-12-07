import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Instagram, Facebook } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-foreground text-background">
      <div className="container-wide py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">PS</span>
              </div>
              <div>
                <p className="font-bold text-xl leading-tight">Private</p>
                <p className="font-bold text-xl leading-tight">Shirt</p>
              </div>
            </div>
            <p className="text-background/70 mb-6">
              Sei du selbst. Sei einzigartig. Professionelle Textilveredelung aus Hamburg.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                className="w-10 h-10 bg-background/10 hover:bg-primary rounded-full flex items-center justify-center transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-background/10 hover:bg-primary rounded-full flex items-center justify-center transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <h4 className="font-bold text-lg mb-6">Navigation</h4>
            <ul className="space-y-3">
              {["Home", "Produkte", "Leistungen", "Unternehmen"].map((item) => (
                <li key={item}>
                  <Link
                    to={`/${item.toLowerCase() === "home" ? "" : item.toLowerCase()}`}
                    className="text-background/70 hover:text-secondary transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Services */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <h4 className="font-bold text-lg mb-6">Services</h4>
            <ul className="space-y-3">
              {["Selbst gestalten", "Großbestellung", "Filialen", "Kontakt"].map((item) => (
                <li key={item}>
                  <Link
                    to={`/${item.toLowerCase().replace(/\s+/g, "-").replace("ß", "ss")}`}
                    className="text-background/70 hover:text-secondary transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <h4 className="font-bold text-lg mb-6">Kontakt</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-secondary mt-0.5" />
                <a
                  href="mailto:info@private-shirt.de"
                  className="text-background/70 hover:text-secondary transition-colors"
                >
                  info@private-shirt.de
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-secondary mt-0.5" />
                <a
                  href="tel:040-18075863"
                  className="text-background/70 hover:text-secondary transition-colors"
                >
                  040 - 180 75 863
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-secondary mt-0.5" />
                <span className="text-background/70">
                  Hamburg, Deutschland
                </span>
              </li>
            </ul>
          </motion.div>
        </div>

        <div className="border-t border-background/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-background/50 text-sm">
            © 2026 Private Shirt. Alle Rechte vorbehalten.
          </p>
          <div className="flex gap-6 text-sm">
            <Link to="/datenschutz" className="text-background/50 hover:text-secondary transition-colors">
              Datenschutz
            </Link>
            <Link to="/impressum" className="text-background/50 hover:text-secondary transition-colors">
              Impressum
            </Link>
            <Link to="/agb" className="text-background/50 hover:text-secondary transition-colors">
              AGB
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
