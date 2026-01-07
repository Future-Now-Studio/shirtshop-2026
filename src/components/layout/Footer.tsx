import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Instagram } from "lucide-react";
import logo from "@/assets/group-25.svg";

export const Footer = () => {
  return (
    <footer className="bg-background text-foreground border-t-2 border-border">
      <div className="container-wide py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-6">
              <img
                src={logo}
                alt="Private Shirt Logo"
                className="h-12 w-auto"
              />
            </div>
            <p className="text-muted-foreground mb-6">
              sei du selbst. sei einzigartig. professionelle textilveredelung aus hamburg.
            </p>
            <div className="flex gap-3">
              <a
                href="https://www.instagram.com/privateshirt/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-muted hover:bg-primary rounded-full flex items-center justify-center transition-colors text-foreground"
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
            <h4 className="font-bold text-lg mb-6">navigation</h4>
            <ul className="space-y-3">
              {["home", "produkte", "leistungen", "über uns"].map((item) => (
                <li key={item}>
                  <Link
                    to={`/${
                      item.toLowerCase() === "home" 
                        ? "" 
                        : item === "Über uns"
                        ? "unternehmen"
                        : item.toLowerCase()
                    }`}
                    className="text-muted-foreground hover:text-primary transition-colors"
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
            <h4 className="font-bold text-lg mb-6">services</h4>
            <ul className="space-y-3">
              {["selbst gestalten", "großbestellung", "filialen"].map((item) => (
                <li key={item}>
                  <Link
                    to={`/${item.toLowerCase().replace(/\s+/g, "-").replace("ß", "ss")}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
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
            <h4 className="font-bold text-lg mb-6">kontakt</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-primary mt-0.5" />
                <a
                  href="mailto:info@private-shirt.de"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  info@private-shirt.de
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-primary mt-0.5" />
                <a
                  href="tel:040-18075863"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  040 - 180 75 863
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <span className="text-muted-foreground">
                  hamburg, deutschland
                </span>
              </li>
            </ul>
          </motion.div>
        </div>

        <div className="border-t border-border mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <p className="text-muted-foreground text-sm">
              © 2026 private shirt. alle rechte vorbehalten.
            </p>
            <div className="flex gap-6 text-sm">
              <Link to="/datenschutz" className="text-muted-foreground hover:text-primary transition-colors">
                datenschutz
              </Link>
              <Link to="/impressum" className="text-muted-foreground hover:text-primary transition-colors">
                impressum
              </Link>
              <Link to="/agb" className="text-muted-foreground hover:text-primary transition-colors">
                agb
              </Link>
            </div>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground/70 text-xs">
              webshop erstellt von{" "}
              <a
                href="https://future-now.studio/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors underline"
              >
                future-now studio
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
