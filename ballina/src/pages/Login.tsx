import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/lib/auth'
import { MOCK_LOGINS } from '@/lib/mockData'
import { supabase, USE_MOCK } from '@/lib/supabase'

/**
 * Where to go after login: the page that sent the user here (ProtectedRoute
 * passes state.from, e.g. a mail link to /bestellung/<id>) if it fits the
 * role, otherwise the start page of portal or back office.
 */
function targetFor(isAdmin: boolean, from?: { pathname?: string; search?: string }): string {
  const path = from?.pathname ?? ''
  const home = isAdmin ? '/admin' : '/bestellungen'
  if (!path.startsWith('/') || path.startsWith('//') || path === '/' || path === '/login' || path === '/passwort-setzen') return home
  if (path.startsWith('/admin') !== isAdmin) return home
  return path + (from?.search ?? '')
}

export default function Login() {
  const { signIn, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (USE_MOCK || !supabase) return setError('Im Demo-Modus nicht verfügbar.')
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/passwort-setzen`,
    })
    setLoading(false)
    // Same answer whether or not the address exists (no account enumeration).
    setResetSent(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { isAdmin } = await signIn(email, password)
      navigate(targetFor(isAdmin, from), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  // Already signed in (e.g. bookmark on /login) → straight to the portal.
  if (!authLoading && user && !loading) return <Navigate to={targetFor(!!user.isAdmin, from)} replace />

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-foreground lg:block">
        <div className="pointer-events-none absolute -left-20 top-1/3 size-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-background">
          <BrandMark invert className="h-10" />
          <div>
            {/* No testimonial-style quote: only state what the portal does. */}
            <p className="text-2xl font-semibold leading-snug">
              Anfragen, Angebote und Nachbestellungen – an einem Ort.
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

          {resetMode ? (
            <form onSubmit={handleReset} className="mt-8 space-y-4">
              <p className="text-sm text-muted-foreground">
                Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Link, mit dem Sie ein neues Passwort festlegen.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">E-Mail</Label>
                <Input id="reset-email" type="email" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {resetSent && (
                <div role="status" className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                  Falls ein Konto mit dieser Adresse existiert, ist die E-Mail unterwegs.
                </div>
              )}
              {error && <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</div>}
              <Button type="submit" variant="brand" size="xl" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Link anfordern
              </Button>
              <button type="button" onClick={() => { setResetMode(false); setResetSent(false); setError('') }}
                className="text-sm text-muted-foreground hover:text-foreground">
                Zurück zur Anmeldung
              </button>
            </form>
          ) : (
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
            <button type="button" onClick={() => { setResetMode(true); setError('') }}
              className="text-sm text-muted-foreground hover:text-foreground">
              Passwort vergessen?
            </button>
          </form>
          )}

          {USE_MOCK && (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Demo-Zugang Kunde</p>
              <p className="mt-1">{MOCK_LOGINS.customer.email} · {MOCK_LOGINS.customer.password}</p>
              <p className="mt-2 font-medium text-foreground">Demo-Zugang Backoffice</p>
              <p className="mt-1">{MOCK_LOGINS.admin.email} · {MOCK_LOGINS.admin.password}</p>
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
