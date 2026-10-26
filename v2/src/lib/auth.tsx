import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthError, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** Landing page of admin invite and password-reset links. */
export const SET_PASSWORD_PATH = "/admin/passwort-setzen";

// Links from the default Supabase templates land on the Site URL with
// "#access_token…&type=invite|recovery" (or "#…error_code=otp_expired").
// Remember the type and move to the set-password page before the router
// starts; supabase-js still reads the tokens from the kept hash.
const linkHash = typeof window !== "undefined" ? window.location.hash : "";
export const AUTH_LINK_TYPE: "invite" | "recovery" | null =
  (/[#&]type=(invite|recovery)\b/.exec(linkHash)?.[1] as "invite" | "recovery" | undefined) ?? null;
if ((AUTH_LINK_TYPE || /[#&]error_code=otp_expired\b/.test(linkHash)) && window.location.pathname !== SET_PASSWORD_PATH) {
  window.history.replaceState(window.history.state, "", SET_PASSWORD_PATH + window.location.search + linkHash);
}

/** Admin password rule (mirrors [auth] in supabase/config.toml): ≥ 12 characters, letters and digits. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 12) return "Das Passwort muss mindestens 12 Zeichen lang sein.";
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return "Das Passwort muss Buchstaben (a–z) und Ziffern enthalten.";
  return null;
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function isRateLimit(error: AuthError) {
  return error.status === 429 || /rate limit|too many|over_.*_limit/i.test(`${error.code ?? ""} ${error.message}`);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };
    if (/invalid login credentials/i.test(error.message)) return { error: "E-Mail oder Passwort ist falsch." };
    if (/email not confirmed/i.test(error.message)) return { error: "Die E-Mail-Adresse ist noch nicht bestätigt." };
    if (/rate limit|too many/i.test(error.message)) return { error: "Zu viele Versuche. Bitte kurz warten." };
    return { error: "Anmeldung fehlgeschlagen. Bitte später erneut versuchen." };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  // Same answer whether or not the address has an account (no enumeration).
  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${SET_PASSWORD_PATH}`,
    });
    if (!error) return { error: null };
    if (isRateLimit(error)) return { error: "Zu viele Anfragen. Bitte warte ein paar Minuten und versuche es dann erneut." };
    if (/invalid|validate email/i.test(error.message)) return { error: "Bitte eine gültige E-Mail-Adresse eingeben." };
    return { error: "Der Link konnte nicht verschickt werden. Bitte später erneut versuchen." };
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) return { error: null };
    const code = `${error.code ?? ""} ${error.message}`;
    if (/weak_password|weak|pwned|leaked/i.test(code)) return { error: "Das Passwort ist zu schwach oder kommt in bekannten Datenlecks vor. Bitte ein anderes wählen (mind. 12 Zeichen, Buchstaben und Ziffern)." };
    if (/same_password|different from the old/i.test(code)) return { error: "Das neue Passwort muss sich vom bisherigen unterscheiden." };
    if (/reauthentication/i.test(code)) return { error: "Aus Sicherheitsgründen bitte neu anmelden (oder „Passwort vergessen?“ nutzen) und es dann erneut versuchen." };
    if (/session|jwt|not authenticated|missing/i.test(code)) return { error: "Der Link ist abgelaufen. Bitte über „Passwort vergessen?“ einen neuen anfordern." };
    if (isRateLimit(error)) return { error: "Zu viele Versuche. Bitte kurz warten." };
    return { error: "Das Passwort konnte nicht gespeichert werden. Bitte später erneut versuchen." };
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut, requestPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
