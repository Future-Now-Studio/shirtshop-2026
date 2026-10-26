import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { LEGAL_CONTENT, LEGAL_FINAL, type LegalDoc } from '@/lib/legal'
import { useAuth } from '@/lib/auth'

const LINKS: [LegalDoc, string][] = [
  ['impressum', 'Impressum'],
  ['datenschutz', 'Datenschutz'],
  ['agb', 'AGB'],
  ['widerruf', 'Widerruf'],
]

export default function Legal({ doc }: { doc: LegalDoc }) {
  const { title, body } = LEGAL_CONTENT[doc]
  const { user, isAdmin } = useAuth()
  // Signed-in users reach these pages from the portal footer: lead them back there.
  const back = user ? { to: isAdmin ? '/admin' : '/bestellungen', label: 'Zurück zum Portal' } : { to: '/', label: 'Startseite' }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to={back.to}>
            <BrandMark />
          </Link>
          <Link to={back.to} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> {back.label}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {!LEGAL_FINAL && (
          <p role="note" className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            Entwurf: Die mit «…» markierten Angaben sind Platzhalter. Dieser Text wird vor dem
            Livegang vervollständigt und rechtlich geprüft.
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-8 space-y-6">
          {body.map((s, i) => (
            <section key={i}>
              {s.h && <h2 className="text-base font-semibold">{s.h}</h2>}
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{s.p}</p>
            </section>
          ))}
        </div>
        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
          {LINKS.filter(([key]) => key !== doc).map(([key, label]) => (
            <Link key={key} to={`/${key}`} className="hover:text-foreground">
              {label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  )
}
