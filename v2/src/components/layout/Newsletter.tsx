import { Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { invokeFn } from "@/lib/functions";
import { Honeypot, isBot } from "@/components/Honeypot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SendStatus = "sent" | "recent" | "confirmed";

const DONE_TEXT: Record<SendStatus, string> = {
  sent: "Fast geschafft! Wir haben dir eine E-Mail geschickt – bitte bestätige deine Anmeldung über den Link darin.",
  recent: "Wir haben dir bereits eine Bestätigungsmail geschickt. Bitte schau auch im Spam-Ordner nach – kam nichts an, kannst du dich nach 7 Tagen erneut anmelden.",
  confirmed: "Diese E-Mail-Adresse ist bereits für unseren Newsletter angemeldet.",
};

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<SendStatus | null>(null);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isBot(e.currentTarget as HTMLFormElement)) { setDone("sent"); return; }
    const address = email.trim().toLowerCase();
    setBusy(true);
    setError("");
    try {
      const { error: insErr } = await supabase.from("newsletter_subscribers").insert({ email: address });
      // 23505 = address already signed up — (re)send the confirmation if allowed
      if (insErr && insErr.code !== "23505") {
        setError(
          insErr.code === "P0001" ? insErr.message
          : insErr.code === "23514" ? "Bitte gib eine gültige E-Mail-Adresse ein."
          : "Anmeldung fehlgeschlagen. Bitte später erneut versuchen."
        );
        return;
      }
      const { data, error: sendErr } = await invokeFn<{ status?: SendStatus }>("newsletter", { action: "send", email: address });
      if (sendErr) { setError(sendErr); return; }
      setDone(data?.status ?? "sent");
      setEmail("");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <p role="status" className="max-w-sm text-sm text-muted-foreground">
        {DONE_TEXT[done]}
      </p>
    );

  return (
    <form onSubmit={submit} className="relative max-w-sm space-y-2">
      <Honeypot />
      <div className="flex gap-2">
        <Input
          type="email"
          required
          aria-label="E-Mail-Adresse für den Newsletter"
          autoComplete="email"
          placeholder="Deine E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-background"
        />
        <Button type="submit" disabled={busy}>Abonnieren</Button>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Mit der Anmeldung willigst du ein, unseren Newsletter per E-Mail zu erhalten. Du bekommst zuerst eine Bestätigungsmail; Abmeldung jederzeit über den Link in jeder E-Mail.
        Details in der <Link to="/datenschutz" className="underline">Datenschutzerklärung</Link>.
      </p>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
