import { Link } from 'react-router-dom'
import { ArrowRight, RefreshCw, ShieldCheck, Truck, Package, Clock, BadgePercent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/BrandMark'
import textileWall from '@/assets/textile-wall.jpg'

const TRUST = [
  { icon: Clock, text: 'Nachbestellen in Minuten' },
  { icon: BadgePercent, text: 'Ihre Firmenkonditionen' },
  { icon: Truck, text: 'Sendungsverfolgung inklusive' },
]

const FEATURES = [
  {
    icon: RefreshCw,
    title: 'Nachbestellen in Sekunden',
    text: 'Frühere Aufträge mit einem Klick identisch wiederholen – gleiche Artikel, Größen und Mengen.',
  },
  {
    icon: Package,
    title: 'Ihr Sortiment im Blick',
    text: 'Ihr hinterlegter Katalog zu Firmenkonditionen. Zusammenstellen, anpassen, absenden.',
  },
  {
    icon: ShieldCheck,
    title: 'Auf Rechnung',
    text: 'Bestellen zu vereinbarten B2B-Konditionen. Keine Zahlung im Prozess nötig.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandMark />
          <Link to="/login">
            <Button variant="brand" size="lg">
              Anmelden
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero — light split layout */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand" />
            Geschäftskunden-Portal
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            Textilbeschaffung für Ihr Unternehmen –{' '}
            <span className="text-brand">ohne Umwege</span>.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Bewährte Artikel zentral verwalten und mit wenigen Klicks nachbestellen. Transparent,
            schnell, zu Ihren Konditionen.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/login">
              <Button variant="brand" size="xl" className="w-full sm:w-auto">
                Zum Portal anmelden
                <ArrowRight className="size-4.5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                Nachbestellung starten
              </Button>
            </Link>
          </div>

          {/* Trust row */}
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TRUST.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <Icon className="size-5 shrink-0 text-brand" />
                <span className="text-sm font-medium text-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bright image */}
        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
            <img
              src={textileWall}
              alt="Farbsortiment gefalteter Textilien im Regal"
              className="aspect-[4/3] size-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="grid size-11 place-items-center rounded-lg bg-brand-muted text-brand">
                  <Icon className="size-5.5" />
                </div>
                <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <BrandMark />
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/impressum" className="hover:text-foreground">Impressum</Link>
            <Link to="/datenschutz" className="hover:text-foreground">Datenschutz</Link>
            <Link to="/agb" className="hover:text-foreground">AGB</Link>
            <Link to="/widerruf" className="hover:text-foreground">Widerruf</Link>
          </nav>
          <p>© 2026 Ballina</p>
        </div>
      </footer>
    </div>
  )
}
