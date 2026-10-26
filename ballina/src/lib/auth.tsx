import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase, USE_MOCK } from './supabase'
import { MOCK_COMPANY, MOCK_LOGINS } from './mockData'

/**
 * Minimum password length enforced in the portal. Keep it equal to (or above)
 * Supabase → Authentication → Policies → minimum length (DEPLOY.md: 10).
 */
export const PASSWORD_MIN_LENGTH = 10

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
  const queryClient = useQueryClient()
  const [user, setUserState] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  // undefined = not resolved yet (first resolution never clears the cache)
  const userIdRef = useRef<string | null | undefined>(undefined)

  // Cached queries (['orders'], ['company'], …) belong to the signed-in user:
  // drop them whenever the user changes (logout, login as someone else).
  const setUser = useCallback(
    (u: AuthUser | null) => {
      const id = u?.id ?? null
      if (userIdRef.current !== undefined && userIdRef.current !== id) queryClient.clear()
      userIdRef.current = id
      setUserState(u)
    },
    [queryClient],
  )

  useEffect(() => {
    if (USE_MOCK || !supabase) {
      let mockUser: AuthUser | null = null
      try {
        const raw = localStorage.getItem(LS_MOCK_USER)
        mockUser = raw ? (JSON.parse(raw) as AuthUser) : null
      } catch {
        /* ignore */
      }
      setUser(mockUser)
      setLoading(false)
      return
    }
    const apply = async (session: Session | null) => {
      const u = session?.user
      if (u) setUser({ id: u.id, email: u.email ?? '', isAdmin: await resolveAdmin(u.id) })
      else setUser(null)
    }
    supabase.auth.getSession().then(async ({ data }) => {
      await apply(data.session)
      setLoading(false)
    })
    // supabase-js runs this callback while holding its auth lock: defer the
    // b2b_admins lookup so it cannot dead-lock against that lock.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => void apply(session), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [setUser])

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
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
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
    try {
      await supabase.auth.signOut()
    } finally {
      // Don't wait for the SIGNED_OUT event: clear user + cache right away.
      setUser(null)
      queryClient.clear()
    }
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

/**
 * Change the password of the signed-in user. The current password is checked
 * first, so an unattended open session cannot be taken over.
 */
export async function changePassword(email: string, current: string, next: string): Promise<void> {
  if (USE_MOCK || !supabase) throw new Error('Im Demo-Modus nicht verfügbar.')
  if (next.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Das neue Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`)
  }
  const { error: checkErr } = await supabase.auth.signInWithPassword({ email, password: current })
  if (checkErr) {
    throw new Error(
      /invalid login credentials/i.test(checkErr.message)
        ? 'Das aktuelle Passwort ist nicht korrekt.'
        : authErrorMessage(checkErr.message),
    )
  }
  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) throw new Error(authErrorMessage(error.message))
}

/** German message for a Supabase auth error. */
export function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-Mail oder Passwort ist falsch.'
  if (/email not confirmed/i.test(message)) return 'Die E-Mail-Adresse ist noch nicht bestätigt.'
  if (/rate limit|too many|security purposes/i.test(message)) return 'Zu viele Versuche. Bitte kurz warten und erneut versuchen.'
  if (/password should be at least|weak|easy to guess|pwned|leaked/i.test(message)) {
    return `Das Passwort ist zu kurz oder zu unsicher (mind. ${PASSWORD_MIN_LENGTH} Zeichen, kein bekanntes Passwort).`
  }
  if (/same.*password|different from the old/i.test(message)) return 'Bitte ein anderes als das bisherige Passwort wählen.'
  if (/session|jwt|not authenticated/i.test(message)) return 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.'
  return 'Das hat nicht geklappt. Bitte später erneut versuchen.'
}
