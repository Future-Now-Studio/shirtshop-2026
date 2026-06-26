import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import aboutImage from "@/assets/lifestyle-woman.jpg";

const FAQ = [
  {
    q: "Wie lange dauert die Bearbeitung meiner Bestellung?",
    a: "Standard-Bestellungen werden in der Regel innerhalb von 3–5 Werktagen bearbeitet und versendet. Bei individuellen Drucken oder Stickereien kann es 5–10 Werktage dauern. Großbestellungen besprechen wir individuell.",
  },
  {
    q: "Kann ich meine eigenen Designs hochladen?",
    a: "Ja! Mit unserem Creator lädst du eigene Designs hoch und platzierst sie direkt auf den Produkten. Wir unterstützen PNG, JPG, SVG und PDF — für beste Qualität empfehlen wir Vektordateien.",
  },
  {
    q: "Was ist der Mindestbestellwert?",
    a: "Der Mindestbestellwert beträgt 25 €. Bei Großbestellungen ab 50 Stück bieten wir attraktive Mengenrabatte. Kontaktiere uns gerne für ein individuelles Angebot.",
  },
  {
    q: "Welche Zahlungsmethoden werden akzeptiert?",
    a: "Kreditkarte, PayPal, Vorkasse und Rechnung (für Geschäftskunden). Alle Zahlungen laufen sicher über verschlüsselte Verbindungen.",
  },
  {
    q: "Was ist, wenn das Produkt nicht passt?",
    a: "Du hast 14 Tage Zeit, ungetragene und unveränderte Artikel zurückzugeben. Individualisierte Produkte (mit Druck/Stickerei) können nur bei Mängeln zurückgegeben werden.",
  },
  {
    q: "Bieten Sie Großbestellungen für Unternehmen an?",
    a: "Ja, wir sind spezialisiert auf Großbestellungen für Unternehmen, Vereine und Events — mit individueller Beratung, Mengenrabatten und Umsetzung deiner Firmenlogos.",
  },
];

export function AboutTeaser() {
  return (
    <section className="mt-20 grid items-center gap-10 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card md:grid-cols-2">
      <img src={aboutImage} alt="Private Shirt Hamburg" className="h-full max-h-80 w-full object-cover" />
      <div className="p-8 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Aus Hamburg</p>
        <h2 className="mt-2 text-3xl font-extrabold">Professionelle Textilveredelung</h2>
        <p className="mt-4 text-muted-foreground">
          Seit über zehn Jahren stehen wir für Qualität und Service — von der Kleinstauflage bis zur
          Großserie. Markentextilien, erstklassige Druckverfahren und freundliche Fachberatung.
        </p>
        <Link to="/unternehmen" className="mt-6 inline-block">
          <Button variant="outline">
            Mehr über uns <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section className="mt-20">
      <h2 className="text-center text-3xl font-extrabold">Häufige Fragen</h2>
      <p className="mt-2 text-center text-muted-foreground">Alles Wichtige rund um Bestellung, Druck und Versand.</p>
      <div className="mx-auto mt-8 max-w-3xl space-y-3">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-border/60 bg-card p-5 shadow-sm [&_svg]:open:rotate-45">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {f.q}
              <Plus className="h-5 w-5 shrink-0 text-primary transition-transform" />
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ContactBanner() {
  return (
    <section className="mt-20 overflow-hidden rounded-3xl gradient-bg px-8 py-14 text-center text-primary-foreground shadow-glow sm:px-14">
      <h2 className="text-3xl font-extrabold sm:text-4xl">Bereit für dein eigenes Design?</h2>
      <p className="mx-auto mt-3 max-w-xl text-primary-foreground/90">
        Gestalte jetzt dein Textil im Browser — oder frag ein individuelles Angebot für deine
        Großbestellung an.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <a href="#produkte">
          <Button size="lg" variant="secondary">Jetzt gestalten</Button>
        </a>
        <Link to="/grossbestellung">
          <Button size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
            Großbestellung anfragen
          </Button>
        </Link>
      </div>
    </section>
  );
}
