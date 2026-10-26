import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const { signIn, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setError(error);
    else navigate("/admin");
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await requestPasswordReset(email);
    setBusy(false);
    if (error) return setError(error);
    setNotice("Falls es zu dieser Adresse ein Admin-Konto gibt, haben wir dir einen Link zum Festlegen eines neuen Passworts geschickt. Bitte prüfe auch den Spam-Ordner.");
  }

  function switchMode(next: "login" | "reset") {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm items-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Admin-Login" : "Passwort zurücksetzen"}</CardTitle>
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="password">Passwort</Label>
                  <button type="button" onClick={() => switchMode("reset")} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                    Passwort vergessen?
                  </button>
                </div>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Anmelden…" : "Anmelden"}
              </Button>
            </form>
          ) : (
            <form onSubmit={onReset} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Gib die E-Mail-Adresse deines Admin-Kontos ein. Wir schicken dir einen Link, über den du ein neues Passwort festlegst.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">E-Mail</Label>
                <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {notice && <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">{notice}</p>}
              <Button type="submit" className="w-full" disabled={busy || !!notice}>
                {busy ? "Senden…" : "Link senden"}
              </Button>
              <button type="button" onClick={() => switchMode("login")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline">
                Zurück zur Anmeldung
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
