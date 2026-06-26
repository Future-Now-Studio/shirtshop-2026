import { Link } from "react-router-dom";
import logo from "@/assets/group-25.svg";
import Newsletter from "./Newsletter";

const COLS = [
  {
    title: "Shop",
    links: [
      { to: "/", label: "Produkte" },
      { to: "/grossbestellung", label: "Großbestellung" },
      { to: "/leistungen", label: "Leistungen" },
    ],
  },
  {
    title: "Unternehmen",
    links: [
      { to: "/unternehmen", label: "Über uns" },
      { to: "/filialen", label: "Filialen" },
      { to: "/kontakt", label: "Kontakt" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { to: "/impressum", label: "Impressum" },
      { to: "/agb", label: "AGB" },
      { to: "/datenschutz", label: "Datenschutz" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-border/60 bg-muted/30">
      <div className="container flex flex-col items-start gap-4 border-b border-border/60 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-bold">Newsletter</p>
          <p className="text-sm text-muted-foreground">Neue Designs, Aktionen & Rabatte — direkt ins Postfach.</p>
        </div>
        <Newsletter />
      </div>
      <div className="container grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <img src={logo} alt="Private Shirt" className="h-9 w-auto" />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Individuell bedruckte Textilien aus Hamburg. Selbst gestalten — in deiner Größe und Farbe.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="mb-4 text-sm font-semibold">{c.title}</p>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="transition-colors hover:text-primary">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60 py-5">
        <p className="container text-xs text-muted-foreground">© 2026 Private Shirt. Alle Rechte vorbehalten.</p>
      </div>
    </footer>
  );
}
