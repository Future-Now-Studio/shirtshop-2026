import { Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { invokeFn } from "@/lib/functions";
import { Honeypot, isBot } from "@/components/Honeypot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isBot(e.currentTarget as HTMLFormElement)) { setState("ok"); return; }
    const { error } = await supabase.from("newsletter_subscribers").insert({ email: email.trim() });
    // 23505 = address already signed up — (re)send the confirmation anyway
    if (error && error.code !== "23505") {
      setError(error.code === "P0001" ? error.message : "Anmeldung fehlgeschlagen. Bitte später erneut versuchen.");
      setState("error");
      return;
    }
    await invokeFn("newsletter", { action: "send", email: email.trim() });
    setState("ok");
    setEmail("");
  }

  if (state === "ok")
    return (
      <p role="status" className="max-w-sm text-sm text-muted-foreground">
        Fast geschafft! Wir haben dir eine E-Mail geschickt – bitte bestätige deine Anmeldung über den Link darin.
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
        <Button type="submit">Abonnieren</Button>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Mit der Anmeldung willigst du ein, unseren Newsletter per E-Mail zu erhalten. Du bekommst zuerst eine Bestätigungsmail; Abmeldung jederzeit über den Link in jeder E-Mail.
        Details in der <Link to="/datenschutz" className="underline">Datenschutzerklärung</Link>.
      </p>
      {state === "error" && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
