import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Instagram } from "lucide-react";
import logo from "@/assets/group-25.svg";
import Newsletter from "./Newsletter";

const NAV = [
  { to: "/", label: "home" },
  { to: "/produkte", label: "produkte" },
  { to: "/leistungen", label: "leistungen" },
  { to: "/unternehmen", label: "über uns" },
];
const SERVICES = [
  { to: "/selbst-gestalten", label: "selbst gestalten" },
  { to: "/grossbestellung", label: "großbestellung" },
  { to: "/filialen", label: "filialen" },
];

export default function Footer() {
  return (
    <footer className="mt-20 border-t-2 border-border bg-background">
      <div className="container flex flex-col items-start gap-4 border-b border-border/60 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-bold lowercase">newsletter</p>
          <p className="text-sm text-muted-foreground">neue designs, aktionen & rabatte — direkt ins postfach.</p>
        </div>
        <Newsletter />
      </div>

      <div className="container grid grid-cols-1 gap-12 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <img src={logo} alt="Private Shirt" className="h-11 w-auto" />
          <p className="mt-5 max-w-xs text-muted-foreground">
            sei du selbst. sei einzigartig. professionelle textilveredelung aus hamburg.
          </p>
          <a
            href="https://www.instagram.com/privateshirt/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Private Shirt auf Instagram"
            className="mt-5 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Instagram className="h-5 w-5" />
          </a>
        </div>

        <div>
          <h4 className="mb-6 text-lg font-bold lowercase">navigation</h4>
          <ul className="space-y-3">
            {NAV.map((l) => (
              <li key={l.to}><Link to={l.to} className="text-muted-foreground transition-colors hover:text-primary">{l.label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-6 text-lg font-bold lowercase">services</h4>
          <ul className="space-y-3">
            {SERVICES.map((l) => (
              <li key={l.to}><Link to={l.to} className="text-muted-foreground transition-colors hover:text-primary">{l.label}</Link></li>
            ))}
            <li><Link to="/kontakt" className="text-muted-foreground transition-colors hover:text-primary">kontakt</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-6 text-lg font-bold lowercase">kontakt</h4>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-primary" />
              <a href="mailto:info@private-shirt.de" className="text-muted-foreground transition-colors hover:text-primary">info@private-shirt.de</a>
            </li>
            <li className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 text-primary" />
              <a href="tel:04032873804" className="text-muted-foreground transition-colors hover:text-primary">040 – 328 73 804</a>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-primary" />
              <span className="text-muted-foreground">hamburg, deutschland</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60 py-5">
        <div className="container flex flex-col items-center justify-between gap-1 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 private shirt. alle rechte vorbehalten.</p>
          <div className="flex gap-5">
            <Link to="/datenschutz" className="hover:text-primary">datenschutz</Link>
            <Link to="/impressum" className="hover:text-primary">impressum</Link>
            <Link to="/agb" className="hover:text-primary">agb</Link>
            <Link to="/widerruf" className="hover:text-primary">widerruf</Link>
          </div>
          <p>webshop erstellt von <span className="font-medium text-foreground">future-now studio</span></p>
        </div>
      </div>
    </footer>
  );
}
