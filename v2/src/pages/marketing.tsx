import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, MapPin, Mail, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import agbRaw from "@/data/agb.txt?raw";
import datenschutzRaw from "@/data/datenschutz.txt?raw";
import hamburgImage from "@/assets/hamburg-city.jpg";
import lifestyleImage from "@/assets/lifestyle-woman.jpg";
import europaStore from "@/assets/Europa-Passage-Store.webp";
import altonaStore from "@/assets/Altona-Store.webp";
import bulkImage from "@/assets/ryoji-hayasaka-gkb-ayjimvda-unsplash@3x-1024x684.jpg";

function Page({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      <h1 className="text-4xl font-extrabold sm:text-5xl">{title}</h1>
      {lead && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{lead}</p>}
      <div className="mt-10">{children}</div>
    </div>
  );
}

/* ---------- Über uns ---------- */
const VALUES = [
  "Eine umfangreiche Produktpalette mit Markentextilien",
  "Erstklassige Produktionsverfahren, die Sie nicht überall finden",
  "Kostengünstige Lösungen bei kleinen und großen Auflagen",
  "Eine freundliche Fachberatung, auf die Sie sich jederzeit verlassen können",
];

export function Unternehmen() {
  return (
    <Page title="Wir sind Private Shirt — geboren in Hamburg.">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="space-y-4 text-muted-foreground">
          <p>
            Guter Stoff für Ihre Ideen. Private Shirt – professionelle Textilveredelung. Sie überzeugen
            Ihre Kunden täglich mit kreativen Ideen und individuellen Dienstleistungen? Dann legen Sie
            bei der Außendarstellung sicher auch hohen Wert auf Qualität.
          </p>
          <p>
            Für einen professionellen Auftritt im Segment Corporate-Fashion-Lösungen gibt es Private
            Shirt. Wir sind die Spezialisten für individuelle Textilveredelung, die durch Qualität
            begeistert!
          </p>
          <p>
            Vom trendigen Marken-Shirt über den fröhlich-bunten Kaffeebecher bis zum kuscheligen
            Bademantel mit Ihrem gestickten oder gedruckten Firmenlogo: Wer einen gelungenen Aufhänger
            für seine Ideen sucht, findet bei Private Shirt Corporate-Fashion-Lösungen und Geschenkideen,
            die besonders anziehend sind – und länger im Gedächtnis bleiben.
          </p>
        </div>
        <img src={hamburgImage} alt="Hamburg" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-card" />
      </div>

      <div className="mt-16 grid items-center gap-10 md:grid-cols-2">
        <img src={lifestyleImage} alt="Team" className="order-2 aspect-[4/3] w-full rounded-3xl object-cover shadow-card md:order-1" />
        <div className="order-1 md:order-2">
          <h2 className="text-2xl font-bold">
            Textilveredelung, die seit zehn Jahren mit Qualität und Service überzeugt.
          </h2>
          <ul className="mt-6 space-y-3">
            {VALUES.map((v) => (
              <li key={v} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-4 w-4" />
                </span>
                <span className="text-muted-foreground">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Page>
  );
}

/* ---------- Leistungen ---------- */
const METHODS = [
  {
    name: "Digitaldirektdruck (DTG)",
    desc: "Alles ist möglich: komplexe und fotorealistische Druckmotive. Produktion ab einem Stück, auf Weiß nicht spürbar, waschbar bis 30 °C.",
    specs: ["Nahezu jeder Farbton druckbar", "Textil mind. 80 % Baumwolle", "Feinste Details & Farbverläufe"],
  },
  {
    name: "Digital Flex (Solvent Digital Transfer)",
    desc: "Weißes Trägermaterial für mehrfarbige Motive, nach individueller Cut-Kontur geschnitten. Ab einem Stück, waschbar bis 30 °C.",
    specs: ["Ein- bis mehrfarbig", "Für fast alle Textilien", "Fotorealistisch, Strichstärke ab 2 mm"],
  },
  {
    name: "Siebdruck (hell & dunkel)",
    desc: "Die traditionellste Druckart. Ab 20 Teilen, Produktionszeit ab 7 Werktagen. Bei hohen Stückzahlen besonders kostengünstig, waschbar bis 60 °C.",
    specs: ["Mittlere bis große Auflagen", "Farben nach Pantone-Skala", "Film- und Siebkosten je Motiv"],
  },
  {
    name: "Flock",
    desc: "Samtige, leicht erhabene Oberfläche in Standardfarben. Produktion ab einem Stück, waschbar bis 40 °C.",
    specs: ["Ein- bis mehrfarbig nach Farbkarte", "Für fast alle Textilien", "Strichstärke ab 2 mm"],
  },
  {
    name: "Sublimation (All-Over)",
    desc: "Ab 10 weißen Polyestershirts All-Over-Druck über unsere 100×150 cm Transferpresse. Nicht fühlbar, bis zu 4-farbig, waschbar bis 40 °C.",
    specs: ["All-Over möglich", "Bis 4-farbiger Druck", "Weiße Polyestertextilien"],
  },
];

export function Leistungen() {
  return (
    <Page
      title="Unsere Druckverfahren"
      lead="Von der Kleinstauflage bis zur Großserie — wir wählen das passende Verfahren für dein Motiv und Textil."
    >
      <div className="grid gap-6 md:grid-cols-2">
        {METHODS.map((m) => (
          <div key={m.name} className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
            <h3 className="text-lg font-bold text-primary">{m.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
            <ul className="mt-4 space-y-2">
              {m.specs.map((s) => (
                <li key={s} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-secondary" /> {s}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ---------- Filialen ---------- */
const STORES = [
  {
    name: "Private Shirt — Europa Passage",
    address: "Ballindamm 40, 20095 Hamburg",
    email: "europa-passage@private-shirt.de",
    phone: "040 328 738 04",
    image: europaStore,
    map: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2370.3681842109295!2d9.993753077509476!3d53.55119465937556!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47b18f1dc6346d17%3A0xb2e7e85ab405c7a7!2sPrivate%20Shirt!5e0!3m2!1sde!2sus!4v1765191779388",
  },
  {
    name: "Private Shirt — Mercado Altona",
    address: "Ottenser Hauptstraße 10, 22765 Hamburg",
    email: "altona@private-shirt.de",
    phone: "040 399 077 78",
    image: altonaStore,
    map: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2370.3038069233694!2d9.93002827750953!3d53.55234395928927!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47b18585ff23b8bb%3A0x3a3a59770b6ae2fa!2sPrivate%20Shirt%20Hamburg%20Altona!5e0!3m2!1sde!2sus!4v1765191827970",
  },
];

export function Filialen() {
  return (
    <Page title="Unsere Filialen" lead="Besuche uns in Hamburg für persönliche Beratung — direkt vor Ort.">
      <div className="grid gap-8 md:grid-cols-2">
        {STORES.map((s) => (
          <div key={s.name} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
            <img src={s.image} alt={s.name} className="h-56 w-full object-cover" />
            <div className="space-y-3 p-6">
              <h3 className="text-xl font-bold text-primary">{s.name}</h3>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-primary" /> {s.address}
              </p>
              <a href={`mailto:${s.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                <Mail className="h-4 w-4 shrink-0 text-primary" /> {s.email}
              </a>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0 text-primary" /> {s.phone}
              </p>
              <div className="overflow-hidden rounded-lg">
                <iframe src={s.map} title={s.name} className="h-48 w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ---------- Großbestellung ---------- */
const BULK = [
  "Mengenrabatte schon ab kleinen Auflagen",
  "Günstigere Stückpreise bei größeren Mengen",
  "Schnelle Lieferung auf Anfrage",
  "Ihr persönlicher Ansprechpartner für alle Fragen",
];

export function Grossbestellung() {
  return (
    <Page
      title="Großbestellung"
      lead="Für Verein, Firma oder Event — mit steigender Stückzahl sinkt der Stückpreis automatisch."
    >
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <ul className="space-y-4">
            {BULK.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-4 w-4" />
                </span>
                <span className="text-muted-foreground">{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Link to="/filialen">
              <Button size="lg">
                Angebot anfragen <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        <img src={bulkImage} alt="Großbestellung" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-card" />
      </div>
    </Page>
  );
}

/* ---------- Impressum ---------- */
export function Impressum() {
  return (
    <Page title="Impressum">
      <div className="space-y-4 text-muted-foreground">
        <div>
          <p className="font-semibold text-foreground">Private Shirt GmbH</p>
          <p>Ballindamm 40</p>
          <p>20095 Hamburg</p>
          <p>Tel.: 040 – 328 73 804</p>
          <p>
            <a href="mailto:info@private-shirt.de" className="text-primary hover:underline">info@private-shirt.de</a>
          </p>
        </div>
        <p><strong className="text-foreground">Geschäftsführer:</strong> Erol Aydin</p>
        <p><strong className="text-foreground">Registergericht:</strong> Amtsgericht Hamburg</p>
        <p><strong className="text-foreground">HRB:</strong> 83191</p>
        <p><strong className="text-foreground">USt-IdNr.:</strong> DE175961471</p>
        <p className="pt-4 text-sm">
          <strong className="text-foreground">Haftungshinweis:</strong> Trotz sorgfältiger inhaltlicher Kontrolle
          übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind
          ausschließlich deren Betreiber verantwortlich.
        </p>
        <p className="text-sm">Angaben gemäß §6 Anbieterkennzeichnung des TDG (Teledienstgesetz).</p>
      </div>
    </Page>
  );
}

/* ---------- Legal long-text renderer (AGB / Datenschutz) ---------- */
function LegalText({ raw }: { raw: string }) {
  const blocks = raw.split("\n").filter(Boolean);
  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
      {blocks.map((line, i) => {
        const [tag, ...rest] = line.split("|");
        const text = rest.join("|");
        if (tag === "H") return <h2 key={i} className="pt-4 text-lg font-bold text-foreground">{text}</h2>;
        return <p key={i}>{text}</p>;
      })}
    </div>
  );
}

export function AGB() {
  return (
    <Page title="Allgemeine Geschäfts- und Lieferbedingungen">
      <LegalText raw={agbRaw} />
    </Page>
  );
}

export function Datenschutz() {
  return (
    <Page title="Datenschutz">
      <LegalText raw={datenschutzRaw} />
    </Page>
  );
}
