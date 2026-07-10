import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, MapPin, Mail, Phone, ArrowRight, Printer, Truck, Shirt, Sparkles, Scissors } from "lucide-react";
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

const UNTERNEHMEN_STATS = [
  { value: "2010", label: "gegründet" },
  { value: "2", label: "filialen in hamburg" },
  { value: "1 Mio+", label: "veredelte teile" },
  { value: "4,7 ★", label: "google-bewertung" },
];

export function Unternehmen() {
  return (
    <div>
      {/* Hero */}
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div className="animate-fade-in">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">über uns</p>
          <h1 className="text-5xl font-black lowercase leading-[0.95] sm:text-6xl">
            <span className="text-primary">wir sind private shirt — </span>
            <span className="italic text-secondary">geboren in hamburg.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            guter stoff für deine ideen. du überzeugst deine kunden täglich mit kreativen ideen und
            individuellen dienstleistungen? dann legst du bei der außendarstellung sicher auch hohen
            wert auf qualität — genau da kommen wir ins spiel.
          </p>
          <Link to="/produkte" className="mt-7 inline-block">
            <Button size="lg">produkte entdecken <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </Link>
        </div>
        <div className="relative">
          <img src={hamburgImage} alt="Hamburg" className="aspect-[4/5] w-full rounded-[2rem] object-cover shadow-card sm:aspect-square" />
          <div className="absolute -bottom-5 -left-3 rounded-2xl border border-border/60 bg-card/95 p-5 shadow-xl backdrop-blur sm:-left-6">
            <p className="text-xl font-black text-primary">seit 2010</p>
            <p className="mt-0.5 text-xs text-muted-foreground">professionelle textilveredelung<br />aus hamburg</p>
          </div>
        </div>
      </div>

      {/* Stats band */}
      <div className="mt-20 grid grid-cols-2 gap-6 rounded-3xl border border-border/60 bg-card p-8 shadow-card sm:grid-cols-4">
        {UNTERNEHMEN_STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-black text-primary sm:text-4xl">{s.value}</p>
            <p className="mt-1 text-xs lowercase text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Story */}
      <div className="mt-20 grid items-center gap-12 md:grid-cols-2">
        <img src={lifestyleImage} alt="Private Shirt Team" className="aspect-[4/3] w-full rounded-[2rem] object-cover shadow-card" />
        <div className="space-y-4 text-muted-foreground">
          <h2 className="text-3xl font-extrabold lowercase text-foreground">für einen auftritt, der bleibt.</h2>
          <p>
            für einen professionellen auftritt im segment corporate fashion gibt es private shirt. wir sind die
            spezialisten für individuelle textilveredelung, die durch qualität begeistert.
          </p>
          <p>
            vom trendigen marken-shirt über den fröhlich-bunten kaffeebecher bis zum kuscheligen bademantel mit
            deinem gestickten oder gedruckten firmenlogo: wer einen gelungenen aufhänger für seine ideen sucht,
            findet bei private shirt corporate-fashion-lösungen und geschenkideen, die besonders anziehend
            sind — und länger im gedächtnis bleiben.
          </p>
        </div>
      </div>

      {/* Values */}
      <div className="mt-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-black lowercase sm:text-4xl">
            unser name steht für textilveredelung, die seit zehn jahren mit <span className="italic text-secondary">qualität & service</span> überzeugt.
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-6 shadow-card">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="h-4 w-4" /></span>
              <span className="text-muted-foreground">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-20 rounded-3xl bg-primary px-8 py-14 text-center text-primary-foreground sm:px-14">
        <h2 className="text-3xl font-extrabold lowercase sm:text-4xl">lernen wir uns kennen.</h2>
        <p className="mx-auto mt-3 max-w-xl text-primary-foreground/90">
          entdecke unsere individuelle beratung, die professionelle ausführung und den erstklassigen service —
          in unseren filialen in hamburg oder direkt online.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/kontakt"><Button size="lg" variant="secondary">kontakt aufnehmen</Button></Link>
          <Link to="/filialen"><Button size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">filialen ansehen</Button></Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- Leistungen ---------- */
const LEISTUNG_FEATURES = [
  { icon: Printer, title: "hochwertige druckmaschinen", desc: "modernste technologie für perfekte ergebnisse" },
  { icon: Sparkles, title: "modernste stickmaschinen", desc: "präzise stickerei mit bis zu 12 nadeln" },
  { icon: Shirt, title: "qualitätstextilien", desc: "nur die besten markenprodukte" },
  { icon: Truck, title: "schnelle lieferung", desc: "express-produktion auf anfrage" },
];

type Method = { name: string; desc: string; fields: [string, string][] };

const PRINT_METHODS: Method[] = [
  {
    name: "flex",
    desc: "Unser liebstes Material zeichnet sich durch eine sehr hohe Robustheit aus. Wir haben eine Farbauswahl von mehr als 24 Farben, darunter auch Neontöne und Glitzereffekte. Produktion ab einem Stück, robust und waschbar bis 40 Grad.",
    fields: [
      ["Stückzahl", "ab einem Stück"],
      ["Farben", "Ein- bis mehrfarbige Drucke, Farbauswahl nach Farbkarte"],
      ["Textilart", "Geeignet für fast alle Textilien"],
      ["Dateiformate", "Vektorisierte Grafiken (.EPS, .AI, .PDF)"],
      ["Besonderheiten", "Druckmotive brauchen mind. 1 mm Strichstärke. Farbverläufe leider nicht möglich."],
    ],
  },
  {
    name: "digital flex (solvent digital transfer)",
    desc: "Weißes Trägermaterial für deine mehrfarbigen Motive: zuerst wird gedruckt, dann nach individueller Cut-Kontur geschnitten. Produktion ab einem Stück, waschbar bis 30 Grad.",
    fields: [
      ["Stückzahl", "Ab einem Stück möglich, Mindermengenaufschlag!"],
      ["Farben", "Ein- bis mehrfarbige Drucke. Nahezu jeder Farbton druckbar."],
      ["Textilart", "Geeignet für fast alle Textilien"],
      ["Dateiformate", "Vektorisierte Grafiken (.EPS, .AI, .PDF)"],
      ["Besonderheiten", "Fotorealistische Drucke, kleinste Details & Farbverläufe. Bei Zuschnitt Strichstärke ab 2 mm."],
    ],
  },
  {
    name: "flock",
    desc: "Flock ist nicht mehr so gefragt, aber wir haben die Standardfarben auf Lager. Für Liebhaber bieten wir dieses Verfahren gerne an — samtige, leicht erhabene Oberfläche, waschbar bis 40 Grad.",
    fields: [
      ["Stückzahl", "Ab einem Stück"],
      ["Farben", "Ein- bis mehrfarbige Drucke, Farbauswahl nach Farbkarte"],
      ["Textilart", "Geeignet für fast alle Textilien"],
      ["Dateiformate", "Vektorisierte Grafiken (.EPS, .AI, .PDF)"],
      ["Besonderheiten", "Druckmotive brauchen mind. 2 mm Strichstärke. Farbverläufe leider nicht möglich."],
    ],
  },
  {
    name: "direktdruck (dtg)",
    desc: "Alles ist möglich: im Digitaldirektdruck (DTG) setzen wir komplexe und fotorealistische Motive um. Produktion ab einem Stück, Druck auf Weiß nicht spürbar, waschbar bis 30 Grad.",
    fields: [
      ["Stückzahl", "Ab einem Stück"],
      ["Farben", "Ein- bis mehrfarbige Drucke. Nahezu jeder Farbton druckbar."],
      ["Textilart", "Textil sollte mind. 80 % Baumwollanteil haben."],
      ["Dateiformate", "Vektorisierte Grafiken (.EPS, .AI, .PDF)"],
      ["Besonderheiten", "Fotorealistische Drucke möglich. Kleinste Details & Farbverläufe umsetzbar."],
    ],
  },
  {
    name: "siebdruck auf hell & dunkel",
    desc: "Die traditionellste aller Druckarten — leider nicht die spontanste. Wir benötigen ein Volumen ab 20 Teilen und mind. 7 Werktage. Dafür: bei hohen Stückzahlen kostengünstig, Farben auf Wasserbasis, waschbar bis 60 Grad.",
    fields: [
      ["Stückzahl", "Mittlere bis große Auflagen (nach Rücksprache ab 20 Stück)"],
      ["Farben", "Ein- bis mehrfarbige Drucke nach der Pantone-Farbskala"],
      ["Textilart", "Fast alle Textilien (außer Fleece, Frottee usw.)"],
      ["Dateiformate", "Vektorisierte Grafiken (.EPS, .AI, .PDF)"],
      ["Besonderheiten", "Film- und Siebkosten je Motiv — größere Auflagen sind empfehlenswert."],
    ],
  },
  {
    name: "sublimation",
    desc: "Komplizierter, aber machbar: ab einer Auflage von 10 weißen Polyestershirts drucken wir All-Over. Unsere 100×150 cm große Transferpresse macht's möglich — waschbar bis 40 Grad, nicht fühlbar.",
    fields: [
      ["Stückzahl", "Ab 10 weißen Polyestershirts (All-Over möglich)"],
      ["Farben", "Bis zu 4-farbiger Druck"],
      ["Textilart", "Weiße Polyestertextilien"],
      ["Dateiformate", "Vektorisierte Grafiken (.EPS, .AI, .PDF)"],
      ["Besonderheiten", "All-Over-Druck mit unserer 100×150 cm Transferpresse. Nicht fühlbarer Druck."],
    ],
  },
];

const STITCH_METHODS: Method[] = [
  {
    name: "direktstick",
    desc: "Eine der schicksten Veredelungsmethoden — ob ein- oder mehrfarbig macht meist keinen großen Preisunterschied. Wichtig ist die einmalig berechnete Stickkarte; sind die Einrichtungskosten bezahlt, ist der Stick auf Textil oder Snapback günstig.",
    fields: [
      ["Stückzahl", "Ab einem Stück"],
      ["Garnfarben", "Nahezu unbegrenzte Farbauswahl"],
      ["Textilart", "Geeignet für fast alle Textilien"],
      ["Dateiformate", "Vektorisierte Grafiken (.EPS, .AI, .PDF) für die Stickkarte. Formate: DST, TAB."],
      ["Besonderheiten", "Fallen Kosten für das Stickmotiv an, sind größere Auflagen empfehlenswert."],
    ],
  },
  {
    name: "3d stick",
    desc: "Bei der 3D-Stickerei wird ein Füllmaterial (Schaumstoff) auf die Textilie gelegt und mitgestickt. Dieses „Puffy\" wirkt erhaben und hebt sich stark ab — ideal für große Buchstaben oder flächige Motive.",
    fields: [
      ["Stückzahl", "Ab 20 Stück"],
      ["Garnfarben", "Nahezu unbegrenzte Farbauswahl"],
      ["Textilart", "Hauptsächlich auf Caps"],
      ["Dateiformate", "Vektorisierte Grafiken (.EPS, .AI, .PDF) für die Stickkarte. Formate: DST, TAB."],
      ["Besonderheiten", "Nicht jedes Motiv lässt sich als 3D-Motiv sticken."],
    ],
  },
  {
    name: "patches / aufnäher",
    desc: "Gestickte Aufnäher nach eurem Motiv und in beliebigen Formen — ob mit Klettverschluss oder Schmelzkleber. Wir liefern bereits ab einer Mindestmenge von 30 Stück.",
    fields: [
      ["Stückzahl", "Ab 30 Stück"],
      ["Garnfarben", "Nahezu unbegrenzte Farbauswahl"],
      ["Textilart", "Geeignet für fast alle Textilien"],
      ["Dateiformate", "Vektorisierte Grafiken (.EPS, .AI, .PDF) für die Stickkarte. Formate: DST, TAB."],
      ["Besonderheiten", "Der Aufnäher lässt sich auf fast jeden Untergrund selbst aufbringen."],
    ],
  },
];

function MethodCard({ m }: { m: Method }) {
  return (
    <div className="hover-lift rounded-2xl border border-border/60 bg-card p-6 shadow-card sm:p-7">
      <h3 className="text-xl font-bold lowercase text-primary">{m.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
      <dl className="mt-5 space-y-3 border-t border-border/60 pt-5">
        {m.fields.map(([k, v]) => (
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
  );
}

function GroupHeader({ icon: Icon, head, gold, lead }: { icon: typeof Printer; head: string; gold: string; lead: string }) {
  return (
    <div className="mb-8 text-center">
      <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="text-3xl font-black lowercase sm:text-4xl">
        <span className="text-primary">{head}</span><span className="italic text-secondary">{gold}</span>
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{lead}</p>
    </div>
  );
}

export function Leistungen() {
  return (
    <div>
      <PageHero
        pre="leistungen"
        head="aufdruck für"
        gold="eindruck."
        lead="ob online oder in unseren shops — wir garantieren hochwertige produkte und top service für deine individuellen ideen."
      />

      {/* Feature highlights */}
      <div className="mb-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {LEISTUNG_FEATURES.map((f) => (
          <div key={f.title} className="hover-lift rounded-2xl border border-border/60 bg-card p-6 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="font-bold lowercase">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Print techniques */}
      <GroupHeader icon={Printer} head="drucktechniken" gold=":" lead="verschiedene druckverfahren für jeden bedarf und jede stückzahl." />
      <div className="grid gap-6 lg:grid-cols-2">
        {PRINT_METHODS.map((m) => <MethodCard key={m.name} m={m} />)}
      </div>

      {/* Embroidery */}
      <div className="mt-20">
        <GroupHeader icon={Scissors} head="lass' sticken" gold=":" lead="hochwertige stickerei für ein elegantes und langlebiges finish." />
        <div className="grid gap-6 lg:grid-cols-3">
          {STITCH_METHODS.map((m) => <MethodCard key={m.name} m={m} />)}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-20 rounded-3xl bg-primary px-8 py-12 text-center text-primary-foreground">
        <h2 className="text-3xl font-extrabold lowercase">dein motiv, unser handwerk.</h2>
        <p className="mx-auto mt-2 max-w-lg text-primary-foreground/90">nicht sicher, welches verfahren passt? wir beraten dich persönlich.</p>
        <Link to="/kontakt" className="mt-6 inline-block">
          <Button size="lg" variant="secondary">beratung anfragen <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </Link>
      </div>
    </div>
  );
}

/* ---------- Filialen ---------- */
export const STORES = [
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

/* ---------- Widerrufsrecht ---------- */
export function Widerruf() {
  return (
    <div>
      <PageHero pre="rechtliches" head="widerrufs" gold="recht." />
      <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-muted-foreground">
        <h2 className="pt-2 text-lg font-bold text-foreground">Widerrufsbelehrung</h2>
        <p>Verbraucher haben ein vierzehntägiges Widerrufsrecht.</p>

        <h3 className="pt-2 font-semibold text-foreground">Widerrufsrecht</h3>
        <p>
          Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.
          Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter
          Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat.
        </p>
        <p>
          Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
        </p>
        <p className="rounded-lg bg-muted/40 p-4 text-foreground">
          Private Shirt GmbH<br />Ballindamm 40, 20095 Hamburg<br />
          Tel.: 040 – 328 73 804<br />
          E-Mail: <a href="mailto:info@private-shirt.de" className="text-primary hover:underline">info@private-shirt.de</a>
        </p>
        <p>
          mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über
          Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte
          Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Zur Wahrung der
          Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor
          Ablauf der Widerrufsfrist absenden.
        </p>

        <h3 className="pt-2 font-semibold text-foreground">Folgen des Widerrufs</h3>
        <p>
          Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben,
          einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass
          Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt
          haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die
          Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung
          verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben,
          es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen
          dieser Rückzahlung Entgelte berechnet.
        </p>
        <p>
          Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den
          Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere
          Zeitpunkt ist. Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab
          dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns zurückzusenden. Sie
          tragen die unmittelbaren Kosten der Rücksendung der Waren.
        </p>

        <h3 className="pt-2 font-semibold text-foreground">Ausschluss des Widerrufsrechts</h3>
        <p>
          Das Widerrufsrecht besteht nicht bei Verträgen zur Lieferung von Waren, die nicht vorgefertigt sind
          und für deren Herstellung eine individuelle Auswahl oder Bestimmung durch den Verbraucher maßgeblich
          ist oder die eindeutig auf die persönlichen Bedürfnisse des Verbrauchers zugeschnitten sind
          (individuell bedruckte oder gestaltete Textilien).
        </p>

        <h2 className="pt-4 text-lg font-bold text-foreground">Muster-Widerrufsformular</h2>
        <p className="italic">
          (Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und senden es zurück.)
        </p>
        <div className="space-y-2 rounded-lg border border-dashed p-4">
          <p>An Private Shirt GmbH, Ballindamm 40, 20095 Hamburg, E-Mail: info@private-shirt.de:</p>
          <p>Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*):</p>
          <p>_______________________________________________</p>
          <p>Bestellt am (*) / erhalten am (*): ____________________</p>
          <p>Name des/der Verbraucher(s): ____________________</p>
          <p>Anschrift des/der Verbraucher(s): ____________________</p>
          <p>Datum, Unterschrift (nur bei Mitteilung auf Papier): ____________________</p>
          <p className="text-xs">(*) Unzutreffendes streichen.</p>
        </div>
      </div>
    </div>
  );
}
