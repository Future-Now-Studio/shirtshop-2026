import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus, MapPin, Phone, Mail, Sparkles, Layers, Palette, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { STORES } from "@/pages/marketing";
import aboutImage from "@/assets/lifestyle-woman.jpg";
import hamburgImage from "@/assets/hamburg-city.jpg";

/* ---------- Highlights slider ---------- */
async function fetchHighlights() {
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, base_price, variants(id, hex, colors(hex), variant_images(view, storage_path))")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;
  return data;
}

export function ProductHighlights() {
  const { data } = useQuery({ queryKey: ["highlights"], queryFn: fetchHighlights });
  if (!data || data.length === 0) return null;

  return (
    <section className="mt-4">
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-secondary" />
        <h2 className="text-3xl font-extrabold lowercase">highlights</h2>
      </div>
      <div className="-mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {data.map((p: any) => {
          const img = p.variants?.[0]?.variant_images?.find((i: any) => i.view === "front");
          const url = img ? supabase.storage.from("product-images").getPublicUrl(img.storage_path).data.publicUrl : null;
          return (
            <Link
              key={p.id}
              to={`/produkt/${p.slug}`}
              className="hover-lift w-64 shrink-0 snap-start overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card"
            >
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-white">
                {url ? (
                  <img src={url} alt={p.name} className="h-full w-full object-contain p-3" />
                ) : (
                  <div className="flex h-full">
                    {(p.variants ?? []).slice(0, 4).map((v: any) => (
                      <div key={v.id} className="h-full flex-1" style={{ backgroundColor: v.hex ?? v.colors?.hex }} />
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="truncate font-bold">{p.name}</h3>
                <p className="mt-1 font-bold text-primary">{Number(p.base_price).toFixed(2)} €</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Shop bento ---------- */
export function ShopBento() {
  return (
    <section className="mt-20">
      <div className="grid gap-5 md:grid-cols-3 md:grid-rows-2">
        <Link
          to="/produkte"
          className="hover-lift group relative flex flex-col justify-end overflow-hidden rounded-3xl p-8 text-white shadow-card md:col-span-2 md:row-span-2 md:min-h-[320px]"
        >
          <img src={aboutImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-neutral-900/55" />
          <div className="relative">
            <Layers className="mb-4 h-10 w-10" />
            <h3 className="text-3xl font-extrabold lowercase">shop, shop, hooray.</h3>
            <p className="mt-2 max-w-sm text-white/85">entdecke unsere neuesten kollektionen und gestalte sie nach deinen wünschen.</p>
            <span className="mt-4 inline-flex items-center gap-1 font-semibold">jetzt shoppen <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
          </div>
        </Link>

        <Link
          to="/grossbestellung"
          className="hover-lift group flex flex-col justify-end rounded-3xl border-2 border-secondary/40 bg-card p-7 shadow-card"
        >
          <span className="mb-3 h-2 w-10 rounded-full bg-secondary" />
          <h3 className="text-xl font-bold lowercase">du brauchst masse?</h3>
          <p className="mt-1 text-sm text-muted-foreground">großbestellungen mit mengenrabatt.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">mehr <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
        </Link>

        <Link
          to="/leistungen"
          className="hover-lift group flex flex-col justify-end rounded-3xl border-2 border-primary/30 bg-card p-7 shadow-card"
        >
          <Palette className="mb-2 h-7 w-7 text-primary" />
          <h3 className="text-xl font-bold lowercase">das können wir.</h3>
          <p className="mt-1 text-sm text-muted-foreground">unsere professionellen druckverfahren.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">mehr erfahren <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
        </Link>
      </div>
    </section>
  );
}

/* ---------- Locations ---------- */
export function LocationsTeaser() {
  return (
    <section className="mt-20">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">filialen</p>
        <h2 className="mt-1 text-3xl font-extrabold lowercase">besuch uns in hamburg</h2>
        <p className="mt-2 text-muted-foreground">persönliche beratung in unseren beiden filialen mitten in der stadt.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {STORES.map((s) => (
          <div key={s.name} className="hover-lift overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
            <div className="relative h-48 overflow-hidden">
              <img src={s.image} alt={s.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <h3 className="absolute bottom-3 left-5 text-2xl font-bold capitalize text-white drop-shadow">{s.name}</h3>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <div className="space-y-2.5 text-sm text-muted-foreground">
                <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {s.address}</p>
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-primary" /> {s.phone}</p>
                <a href={`mailto:${s.email}`} className="flex items-center gap-2 break-all hover:text-primary"><Mail className="h-4 w-4 shrink-0 text-primary" /> {s.email}</a>
                <Link to="/filialen" className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-primary">
                  Anfahrt & Details <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/60">
                <iframe src={s.map} title={`Karte ${s.name}`} className="h-40 w-full border-0 sm:h-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

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

const ABOUT_STATS = [
  { value: "2010", label: "gegründet" },
  { value: "2", label: "filialen in hh" },
  { value: "1 Mio+", label: "prints" },
];

export function AboutTeaser() {
  return (
    <section className="mt-24 grid items-center gap-12 md:grid-cols-2">
      {/* Image with floating cards */}
      <div className="relative">
        <div className="hover-lift overflow-hidden rounded-[2rem] shadow-card">
          <img src={hamburgImage} alt="Hamburg — Heimat von Private Shirt" className="aspect-[4/5] w-full object-cover sm:aspect-square" />
        </div>
        {/* seit 2010 badge, overlapping bottom-left */}
        <div className="absolute -bottom-5 -left-3 rounded-2xl border border-border/60 bg-card/95 p-5 shadow-xl backdrop-blur sm:-left-6">
          <p className="text-xl font-black text-primary">seit 2010</p>
          <p className="mt-0.5 text-xs text-muted-foreground">professionelle textilveredelung<br />aus hamburg</p>
        </div>
        {/* google rating chip, overlapping top-right */}
        <div className="absolute -right-3 -top-4 flex items-center gap-1.5 rounded-full border border-border/60 bg-card/95 px-4 py-2 shadow-xl backdrop-blur sm:-right-5">
          <Star className="h-4 w-4 fill-secondary text-secondary" />
          <span className="text-sm font-bold">4,7</span>
          <span className="text-xs text-muted-foreground">google</span>
        </div>
      </div>

      {/* Copy */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">aus hamburg</p>
        <h2 className="mt-3 text-4xl font-black lowercase leading-[0.95] sm:text-5xl">
          <span className="text-primary">wir sind private shirt: </span>
          <span className="italic text-secondary">geboren in hamburg.</span>
        </h2>
        <p className="mt-5 max-w-lg text-muted-foreground">
          guter stoff für deine ideen. seit über zehn jahren veredeln wir markentextilien — von der
          kleinstauflage bis zur großserie, mit erstklassigen druckverfahren und ehrlicher fachberatung.
        </p>
        <dl className="mt-8 flex gap-8">
          {ABOUT_STATS.map((s) => (
            <div key={s.label}>
              <dt className="text-3xl font-black text-primary">{s.value}</dt>
              <dd className="mt-1 text-xs lowercase text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
        <Link to="/unternehmen" className="mt-8 inline-block">
          <Button size="lg">
            jetzt kennenlernen <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section className="mt-20">
      <h2 className="text-center text-4xl font-black lowercase">
        häufig gestellte <span className="italic text-secondary">fragen.</span>
      </h2>
      <p className="mt-2 text-center text-muted-foreground">hier findest du antworten auf die häufigsten fragen zu produkten, bestellungen und services.</p>
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
    <section className="mt-20 overflow-hidden rounded-3xl bg-primary px-8 py-14 text-center text-primary-foreground sm:px-14">
      <h2 className="text-3xl font-extrabold lowercase sm:text-4xl">bereit für dein eigenes design?</h2>
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
