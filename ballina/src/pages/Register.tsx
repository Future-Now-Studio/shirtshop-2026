import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            company,
          },
        },
      })

      if (error) throw error

      // Create B2B user profile
      if (data.user) {
        const { error: profileError } = await supabase
          .from('b2b_profiles')
          .insert({
            user_id: data.user.id,
            email: email,
            company: company,
          })

        if (profileError) throw profileError
      }

      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Registrierung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Registrieren</h1>
          <p className="mt-2 text-slate-600">B2B-Konto bei Ballina erstellen</p>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="company" className="mb-2 block text-sm font-medium">
                Unternehmen
              </label>
              <input
                id="company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
                placeholder="Ihr Unternehmen"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
                placeholder="ihre@email.de"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium">
                Passwort
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
                placeholder="Mindestens 6 Zeichen"
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Registrieren...' : 'Registrieren'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-slate-600">Bereits registriert? </span>
            <Link to="/login" className="font-medium text-primary hover:underline">
              Anmelden
            </Link>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
    </div>
  )
}
