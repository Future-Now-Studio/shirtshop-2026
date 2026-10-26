import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { AUTH_LINK_TYPE, SET_PASSWORD_PATH, passwordProblem, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Landing page of admin invite and password-reset links, and the place where
 * a signed-in admin changes the password. Our templates link here with
 * ?token_hash=…&type=invite|recovery (verified on this page, so mail
 * scanners that only fetch the page cannot use the link up); links from the
 * default Supabase templates arrive with #access_token… and supabase-js
 * creates the session itself.
 */
export default function SetPassword() {
  const { session, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [kind, setKind] = useState<"invite" | "recovery" | null>(AUTH_LINK_TYPE);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A token can be verified only once; keep the promise across effect re-runs.
  const verifying = useRef<ReturnType<typeof supabase.auth.verifyOtp> | null>(null);

  useEffect(() => {
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; setState(ok ? "ready" : "invalid"); } };

    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    if (tokenHash && (type === "invite" || type === "recovery")) {
      setKind(type);
      verifying.current ??= supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      verifying.current.then(({ data, error }) => {
        if (done) return;
        finish(!error && !!data.session);
        navigate(SET_PASSWORD_PATH, { replace: true }); // drop the token from the address bar
      });
      return () => { done = true; };
    }
    // The session from a #access_token link may arrive a moment after mount.
    supabase.auth.getSession().then(({ data }) => data.session && finish(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => s && finish(true));
    const t = setTimeout(() => finish(false), 3000);
    return () => { done = true; clearTimeout(t); sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== repeat) return setError("Die Passwörter stimmen nicht überein.");
    setSaving(true);
    const res = await updatePassword(password);
    setSaving(false);
    if (res.error) return setError(res.error);
    navigate("/admin", { replace: true });
  }

  const title = kind === "invite" ? "Willkommen – Passwort festlegen" : kind === "recovery" ? "Neues Passwort festlegen" : "Passwort ändern";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm items-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {state === "checking" && <p className="text-sm text-muted-foreground">Link wird geprüft…</p>}

          {state === "invalid" && (
            <div className="space-y-3 text-sm">
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">
                Der Link ist ungültig oder abgelaufen.
              </p>
              <p className="text-muted-foreground">
                Fordere auf der Admin-Anmeldung über „Passwort vergessen?“ einen neuen Link an. Einladungen kann der
                Shop-Inhaber erneut verschicken.
              </p>
              <Link to="/admin" className="font-medium text-primary hover:underline">Zur Anmeldung</Link>
            </div>
          )}

          {state === "ready" && (
            <form onSubmit={submit} className="space-y-4">
              {session?.user.email && (
                <p className="text-sm text-muted-foreground">Konto: <span className="font-medium text-foreground">{session.user.email}</span></p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Neues Passwort</Label>
                <Input id="new-password" type="password" autoComplete="new-password" minLength={12} required
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="repeat-password">Passwort wiederholen</Label>
                <Input id="repeat-password" type="password" autoComplete="new-password" minLength={12} required
                  value={repeat} onChange={(e) => setRepeat(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Mindestens 12 Zeichen, mit Buchstaben und Ziffern.</p>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Speichern…" : "Passwort speichern"}
              </Button>
              {!kind && (
                <Link to="/admin" className="block text-center text-sm text-muted-foreground hover:text-foreground hover:underline">
                  Zurück zum Admin-Bereich
                </Link>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
