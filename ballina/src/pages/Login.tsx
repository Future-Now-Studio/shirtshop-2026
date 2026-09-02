import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/lib/auth'
import { USE_MOCK } from '@/lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { isAdmin } = await signIn(email, password)
      navigate(isAdmin ? '/admin' : '/bestellungen')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-foreground lg:block">
        <div className="pointer-events-none absolute -left-20 top-1/3 size-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-background">
          <BrandMark invert className="h-10" />
          <div>
            <p className="text-2xl font-semibold leading-snug">
              „Nachbestellen dauert bei uns keine zwei Minuten mehr."
            </p>
            <p className="mt-4 text-sm text-background/60">
              Ihr zentrales Portal für Textilbeschaffung – Bestellungen, Status und Konditionen an
              einem Ort.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-muted/30 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Willkommen zurück. Melden Sie sich in Ihrem B2B-Konto an.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="einkauf@ihre-firma.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" variant="brand" size="xl" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? 'Wird angemeldet…' : 'Anmelden'}
            </Button>
          </form>

          {USE_MOCK && (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Demo-Zugang Kunde</p>
              <p className="mt-1">einkauf@brauhaus-lindental.de · Ballina2026!</p>
              <p className="mt-2 font-medium text-foreground">Demo-Zugang Backoffice</p>
              <p className="mt-1">admin@ballina.de · Ballina-Admin2026!</p>
            </div>
          )}

          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Zurück zur Startseite
          </Link>
        </div>
      </div>
    </div>
  )
}
