import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { BrandMark } from '@/components/BrandMark'
import { authErrorMessage, PASSWORD_MIN_LENGTH } from '@/lib/auth'
import { AUTH_LINK_TYPE, supabase, USE_MOCK } from '@/lib/supabase'

/**
 * Landing page of invite and password-reset links. supabase-js signs the user
 * in from the link; here they choose their password.
 */
export default function SetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState<'checking' | 'ok' | 'expired'>('checking')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (USE_MOCK || !supabase) { setReady('expired'); return }
    // An expired / used link comes back as "#error=…&error_code=otp_expired".
    if (/[#&?]error(_code)?=/.test(window.location.hash + window.location.search)) { setReady('expired'); return }
    // supabase-js first verifies the link (network round trip) and only then
    // emits INITIAL_SESSION (with or without session). Decide on that event
    // instead of a short fixed timeout (slow mobile connections).
    // Only a session that comes from an invite/reset link may set a password
    // without the current one — an already signed-in browser must not (an
    // unattended session would allow an account takeover). Logged-in users
    // change their password under "Mein Konto" with the current password.
    let done = false
    const finish = (ok: boolean) => { if (!done) { done = true; setReady(ok ? 'ok' : 'expired') } }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (AUTH_LINK_TYPE || event === 'PASSWORD_RECOVERY')) finish(true)
      else if (event === 'INITIAL_SESSION') finish(false)
    })
    supabase.auth.getSession().then(({ data }) => { if (data.session && AUTH_LINK_TYPE) finish(true) })
    // Last resort if no event arrives at all.
    const t = setTimeout(() => finish(false), 20000)
    return () => { clearTimeout(t); sub.subscription.unsubscribe() }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < PASSWORD_MIN_LENGTH) return setError(`Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`)
    if (password !== repeat) return setError('Die Passwörter stimmen nicht überein.')
    setSaving(true)
    const { error: err } = await supabase!.auth.updateUser({ password })
    setSaving(false)
    if (err) return setError(authErrorMessage(err.message))
    const { data } = await supabase!.auth.getUser()
    const { data: admin } = await supabase!.from('b2b_admins').select('user_id').eq('user_id', data.user?.id ?? '').maybeSingle()
    navigate(admin ? '/admin' : '/bestellungen', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm">
        <BrandMark className="mb-8" />
        <h1 className="text-2xl font-semibold tracking-tight">
          {AUTH_LINK_TYPE === 'recovery' ? 'Neues Passwort festlegen' : 'Willkommen – Passwort festlegen'}
        </h1>

        {ready === 'checking' && <Loader2 className="mt-8 size-6 animate-spin text-brand" />}

        {ready === 'expired' && (
          <div className="mt-6 space-y-4 text-sm">
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-destructive">
              Der Link ist ungültig oder abgelaufen.
            </p>
            <p className="text-muted-foreground">
              Fordern Sie auf der Anmeldeseite über „Passwort vergessen?“ einen neuen Link an.
            </p>
            <Link to="/login" className="font-medium text-brand hover:underline">Zur Anmeldung</Link>
          </div>
        )}

        {ready === 'ok' && (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Neues Passwort</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="repeat-password">Passwort wiederholen</Label>
              <Input id="repeat-password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required
                value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Mindestens {PASSWORD_MIN_LENGTH} Zeichen. Bitte kein Passwort verwenden, das Sie schon anderswo nutzen.
            </p>
            {error && <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</div>}
            <Button type="submit" variant="brand" size="xl" className="w-full" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? 'Wird gespeichert…' : 'Passwort speichern'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
