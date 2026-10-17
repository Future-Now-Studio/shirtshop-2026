import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, USE_MOCK } from './supabase'
import { MOCK_COMPANY, MOCK_LOGINS } from './mockData'

interface AuthUser {
  id: string
  email: string
  isAdmin?: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ isAdmin: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const LS_MOCK_USER = 'ballina_mock_user'

// Real mode: an admin is a user listed in b2b_admins.
async function resolveAdmin(userId: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.from('b2b_admins').select('user_id').eq('user_id', userId).maybeSingle()
  return !!data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (USE_MOCK || !supabase) {
      const raw = localStorage.getItem(LS_MOCK_USER)
      setUser(raw ? (JSON.parse(raw) as AuthUser) : null)
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user
      if (u) setUser({ id: u.id, email: u.email ?? '', isAdmin: await resolveAdmin(u.id) })
      else setUser(null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const u = session?.user
      if (u) setUser({ id: u.id, email: u.email ?? '', isAdmin: await resolveAdmin(u.id) })
      else setUser(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<{ isAdmin: boolean }> {
    if (USE_MOCK || !supabase) {
      const mail = email.trim().toLowerCase()
      if (mail === MOCK_LOGINS.admin.email && password === MOCK_LOGINS.admin.password) {
        const u = { id: 'admin', email: MOCK_LOGINS.admin.email, isAdmin: true }
        localStorage.setItem(LS_MOCK_USER, JSON.stringify(u))
        setUser(u)
        return { isAdmin: true }
      }
      const ok = mail === MOCK_LOGINS.customer.email.toLowerCase() && password === MOCK_LOGINS.customer.password
      if (!ok) throw new Error('E-Mail oder Passwort ist falsch.')
      const u = { id: MOCK_COMPANY.id, email: MOCK_COMPANY.email }
      localStorage.setItem(LS_MOCK_USER, JSON.stringify(u))
      setUser(u)
      return { isAdmin: false }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(authErrorMessage(error.message))
    const isAdmin = data.user ? await resolveAdmin(data.user.id) : false
    if (data.user) setUser({ id: data.user.id, email: data.user.email ?? '', isAdmin })
    return { isAdmin }
  }

  async function signOut() {
    if (USE_MOCK || !supabase) {
      localStorage.removeItem(LS_MOCK_USER)
      setUser(null)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin: !!user?.isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** German message for a Supabase auth error. */
export function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-Mail oder Passwort ist falsch.'
  if (/email not confirmed/i.test(message)) return 'Die E-Mail-Adresse ist noch nicht bestätigt.'
  if (/rate limit|too many|security purposes/i.test(message)) return 'Zu viele Versuche. Bitte kurz warten und erneut versuchen.'
  if (/password should be at least|weak password/i.test(message)) return 'Das Passwort ist zu kurz oder zu schwach (mind. 8 Zeichen).'
  if (/same.*password|different from the old/i.test(message)) return 'Bitte ein anderes als das bisherige Passwort wählen.'
  return 'Das hat nicht geklappt. Bitte später erneut versuchen.'
}
