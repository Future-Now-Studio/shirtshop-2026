import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Shield, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-slate-900" />
            <span className="text-xl font-bold text-slate-900">Ballina</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Anmelden</Button>
            </Link>
            <Link to="/register">
              <Button>Registrieren</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            B2B Textildruck für Ihr Unternehmen
          </h1>
          <p className="mb-8 text-xl text-slate-600">
            Professionelle Großbestellungen mit einfacher Verwaltung. 
            Verfolgen Sie Ihre Bestellungen und bestellen Sie mit wenigen Klicks nach.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link to="/register">
              <Button size="lg" className="gap-2">
                Jetzt registrieren
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline">
                Anmelden
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid gap-8 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Users className="h-6 w-6 text-slate-900" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Kundenportal</h3>
            <p className="text-slate-600">
              Verwalten Sie Ihre Bestellungen und Anfragen an einem zentralen Ort
            </p>
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Shield className="h-6 w-6 text-slate-900" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Sicher</h3>
            <p className="text-slate-600">
              Ihre Daten sind geschützt mit moderner Authentifizierung
            </p>
          </div>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Building2 className="h-6 w-6 text-slate-900" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Einfach</h3>
            <p className="text-slate-600">
              Großbestellungen mit wenigen Klicks - ohne komplizierte Prozesse
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t bg-white py-8">
        <div className="container mx-auto px-4 text-center text-sm text-slate-600">
          <p>© 2026 Ballina. B2B Textildrucklösungen.</p>
        </div>
      </footer>
    </div>
  )
}
