import { Link } from "react-router-dom";

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
    <footer className="mt-16 border-t bg-muted/20">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="font-semibold">ShirtShop v2</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Individuell bedruckte Textilien. Selbst gestalten, in deiner Größe und Farbe.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="mb-3 text-sm font-medium">{c.title}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="hover:text-foreground">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t py-4">
        <p className="container text-xs text-muted-foreground">
          © {/* year set at build via static text */}2026 ShirtShop. Alle Rechte vorbehalten.
        </p>
      </div>
    </footer>
  );
}
