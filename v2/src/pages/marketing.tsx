import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, MapPin, Mail, Phone, ArrowRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import agbRaw from "@/data/agb.txt?raw";
import datenschutzRaw from "@/data/datenschutz.txt?raw";
import hamburgImage from "@/assets/hamburg-city.jpg";
import lifestyleImage from "@/assets/lifestyle-woman.jpg";
import europaStore from "@/assets/Europa-Passage-Store.webp";
import altonaStore from "@/assets/Altona-Store.webp";
import bulkImage from "@/assets/ryoji-hayasaka-gkb-ayjimvda-unsplash@3x-1024x684.jpg";

/* Lowercase two-tone page hero, matching the old subpage style. */
function PageHero({ pre, head, gold, lead }: { pre?: string; head: string; gold: string; lead?: string }) {
  return (
    <div className="mb-14 animate-fade-in">
      {pre && <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">{pre}</p>}
      <h1 className="text-5xl font-black lowercase leading-[0.95] sm:text-6xl">
        <span className="text-primary">{head} </span>
        <span className="italic text-secondary">{gold}</span>
      </h1>
      {lead && <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{lead}</p>}
    </div>
  );
}

/* ---------- Über uns ---------- */
const VALUES = [
  "eine umfangreiche produktpalette mit markentextilien",
  "erstklassige produktionsverfahren, die du nicht überall findest",
  "kostengünstige lösungen bei kleinen und großen auflagen",
  "eine freundliche fachberatung, auf die du dich jederzeit verlassen kannst",
];

export function Unternehmen() {
  return (
    <div>
      <PageHero
        pre="über uns"
        head="wir sind private shirt —"
        gold="geboren in hamburg."
        lead="guter stoff für deine ideen. professionelle textilveredelung, die durch qualität begeistert."
      />
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="space-y-4 text-muted-foreground">
          <p>
            du überzeugst deine kunden täglich mit kreativen ideen und individuellen dienstleistungen? dann
            legst du bei der außendarstellung sicher auch hohen wert auf qualität.
          </p>
          <p>
            vom trendigen marken-shirt über den fröhlich-bunten kaffeebecher bis zum kuscheligen bademantel mit
            deinem gestickten oder gedruckten firmenlogo: wer einen gelungenen aufhänger für seine ideen sucht,
            findet bei private shirt corporate-fashion-lösungen und geschenkideen, die besonders anziehend sind.
          </p>
        </div>
        <img src={hamburgImage} alt="Hamburg" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-card" />
      </div>

      <div className="mt-16 grid items-center gap-10 md:grid-cols-2">
        <img src={lifestyleImage} alt="Team" className="order-2 aspect-[4/3] w-full rounded-3xl object-cover shadow-card md:order-1" />
        <div className="order-1 md:order-2">
          <h2 className="text-2xl font-bold lowercase">seit zehn jahren qualität & service.</h2>
          <ul className="mt-6 space-y-3">
            {VALUES.map((v) => (
              <li key={v} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="h-4 w-4" /></span>
                <span className="text-muted-foreground">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- Leistungen ---------- */
const METHODS = [
  {
    name: "digitaldirektdruck (dtg)",
    desc: "alles ist möglich: komplexe und fotorealistische motive. produktion ab einem stück, auf weiß nicht spürbar, waschbar bis 30 °c.",
    fields: {
      Stückzahl: "ab einem Stück",
      Farben: "nahezu jeder Farbton druckbar",
      Textilart: "mind. 80 % Baumwolle",
      Dateiformate: "vektorisierte Grafiken (.EPS, .AI, .PDF)",
      Besonderheiten: "feinste Details & Farbverläufe",
    },
  },
  {
    name: "digital flex (solvent digital transfer)",
    desc: "weißes trägermaterial für mehrfarbige motive, nach individueller cut-kontur geschnitten. ab einem stück, waschbar bis 30 °c.",
    fields: {
      Stückzahl: "ab einem Stück (Mindermengenaufschlag)",
      Farben: "ein- bis mehrfarbig, nahezu jeder Farbton",
      Textilart: "geeignet für fast alle Textilien",
      Dateiformate: "vektorisierte Grafiken (.EPS, .AI, .PDF)",
      Besonderheiten: "fotorealistisch, Strichstärke ab 2 mm",
    },
  },
  {
    name: "siebdruck (hell & dunkel)",
    desc: "die traditionellste druckart. bei hohen stückzahlen besonders kostengünstig, farben auf wasserbasis, waschbar bis 60 °c.",
    fields: {
      Stückzahl: "ab 20 Teilen, ab 7 Werktagen",
      Farben: "ein- bis mehrfarbig nach Pantone-Skala",
      Textilart: "fast alle (außer Fleece, Frottee)",
      Dateiformate: "vektorisierte Grafiken (.EPS, .AI, .PDF)",
      Besonderheiten: "Film- und Siebkosten je Motiv",
    },
  },
  {
    name: "flock",
    desc: "samtige, leicht erhabene oberfläche in standardfarben. produktion ab einem stück, waschbar bis 40 °c.",
    fields: {
      Stückzahl: "ab einem Stück",
      Farben: "ein- bis mehrfarbig nach Farbkarte",
      Textilart: "geeignet für fast alle Textilien",
      Dateiformate: "vektorisierte Grafiken (.EPS, .AI, .PDF)",
      Besonderheiten: "Strichstärke ab 2 mm",
    },
  },
  {
    name: "sublimation (all-over)",
    desc: "ab 10 weißen polyestershirts all-over-druck über unsere 100×150 cm transferpresse. nicht fühlbar, waschbar bis 40 °c.",
    fields: {
      Stückzahl: "ab 10 weiße Polyestershirts",
      Farben: "bis zu 4-farbig",
      Textilart: "weiße Polyestertextilien",
      Dateiformate: "vektorisierte Grafiken (.EPS, .AI, .PDF)",
      Besonderheiten: "All-Over-Druck möglich",
    },
  },
];

export function Leistungen() {
  return (
    <div>
      <PageHero
        pre="leistungen"
        head="aufdruck für"
        gold="eindruck."
        lead="ob online oder in unseren shops — wir garantieren hochwertige produkte und top service für deine individuellen ideen."
      />

      <div className="mb-8 flex items-center gap-3">
        <Printer className="h-7 w-7 text-primary" />
        <h2 className="text-3xl font-extrabold lowercase">drucktechniken</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {METHODS.map((m) => (
          <div key={m.name} className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
            <h3 className="text-xl font-bold lowercase text-primary">{m.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
            <dl className="mt-5 space-y-3">
              {Object.entries(m.fields).map(([k, v]) => (
                <div key={k} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-primary">{k}</dt>
                    <dd className="text-sm text-muted-foreground">{v}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Filialen ---------- */
const STORES = [
  {
    name: "europa passage",
    address: "Ballindamm 40, 20095 Hamburg",
    email: "europa-passage@private-shirt.de",
    phone: "040 328 738 04",
    image: europaStore,
    map: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2370.3681842109295!2d9.993753077509476!3d53.55119465937556!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47b18f1dc6346d17%3A0xb2e7e85ab405c7a7!2sPrivate%20Shirt!5e0!3m2!1sde!2sus!4v1765191779388",
  },
  {
    name: "mercado altona",
    address: "Ottenser Hauptstraße 10, 22765 Hamburg",
    email: "altona@private-shirt.de",
    phone: "040 399 077 78",
    image: altonaStore,
    map: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2370.3038069233694!2d9.93002827750953!3d53.55234395928927!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47b18585ff23b8bb%3A0x3a3a59770b6ae2fa!2sPrivate%20Shirt%20Hamburg%20Altona!5e0!3m2!1sde!2sus!4v1765191827970",
  },
];

export function Filialen() {
  return (
    <div>
      <PageHero pre="filialen" head="besuch uns" gold="vor ort." lead="persönliche beratung in unseren beiden filialen mitten in hamburg." />
      <div className="grid gap-8 md:grid-cols-2">
        {STORES.map((s) => (
          <div key={s.name} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
            <img src={s.image} alt={s.name} className="h-56 w-full object-cover" />
            <div className="space-y-3 p-6">
              <h3 className="text-xl font-bold lowercase text-primary">{s.name}</h3>
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 shrink-0 text-primary" /> {s.address}</p>
              <a href={`mailto:${s.email}`} className="flex items-center gap-2 text-sm hover:text-primary"><Mail className="h-4 w-4 shrink-0 text-primary" /> {s.email}</a>
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4 shrink-0 text-primary" /> {s.phone}</p>
              <div className="overflow-hidden rounded-lg">
                <iframe src={s.map} title={s.name} className="h-48 w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Großbestellung ---------- */
const BULK = [
  "mengenrabatte schon ab kleinen auflagen",
  "günstigere stückpreise bei größeren mengen",
  "schnelle lieferung auf anfrage",
  "dein persönlicher ansprechpartner für alle fragen",
];

export function Grossbestellung() {
  return (
    <div>
      <PageHero pre="großbestellung" head="viele teile?" gold="kein problem." lead="für verein, firma oder event — mit steigender stückzahl sinkt der stückpreis automatisch." />
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <ul className="space-y-4">
            {BULK.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="h-4 w-4" /></span>
                <span className="text-muted-foreground">{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Link to="/kontakt"><Button size="lg">angebot anfragen <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </div>
        </div>
        <img src={bulkImage} alt="Großbestellung" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-card" />
      </div>
    </div>
  );
}

/* ---------- Impressum ---------- */
export function Impressum() {
  return (
    <div>
      <PageHero pre="rechtliches" head="impressum" gold="." />
      <div className="max-w-3xl space-y-4 text-muted-foreground">
        <div>
          <p className="font-semibold text-foreground">Private Shirt GmbH</p>
          <p>Ballindamm 40</p>
          <p>20095 Hamburg</p>
          <p>Tel.: 040 – 328 73 804</p>
          <p><a href="mailto:info@private-shirt.de" className="text-primary hover:underline">info@private-shirt.de</a></p>
        </div>
        <p><strong className="text-foreground">Geschäftsführer:</strong> Erol Aydin</p>
        <p><strong className="text-foreground">Registergericht:</strong> Amtsgericht Hamburg</p>
        <p><strong className="text-foreground">HRB:</strong> 83191</p>
        <p><strong className="text-foreground">USt-IdNr.:</strong> DE175961471</p>
        <p className="pt-4 text-sm"><strong className="text-foreground">Haftungshinweis:</strong> Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.</p>
        <p className="text-sm">Angaben gemäß §6 Anbieterkennzeichnung des TDG (Teledienstgesetz).</p>
      </div>
    </div>
  );
}

/* ---------- Legal long-text ---------- */
function LegalText({ raw }: { raw: string }) {
  const blocks = raw.split("\n").filter(Boolean);
  return (
    <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-muted-foreground">
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
    <div>
      <PageHero pre="rechtliches" head="agb" gold="." />
      <LegalText raw={agbRaw} />
    </div>
  );
}

export function Datenschutz() {
  return (
    <div>
      <PageHero pre="rechtliches" head="datenschutz" gold="." />
      <LegalText raw={datenschutzRaw} />
    </div>
  );
}
