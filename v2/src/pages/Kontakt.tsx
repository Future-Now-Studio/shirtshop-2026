import { useState } from "react";
import { Mail, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { invokeFn } from "@/lib/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Honeypot, isBot } from "@/components/Honeypot";
import { PrivacyNote } from "@/components/PrivacyNote";

export default function Kontakt() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isBot(e.currentTarget as HTMLFormElement)) { setSent(true); return; }
    setBusy(true);
    setError(null);
    // id generated here: anon may insert but not read back; notify-admin needs it
    const id = crypto.randomUUID();
    const { error } = await supabase.from("contact_messages").insert({
      id,
      name: form.name,
      email: form.email,
      message: form.message,
    });
    setBusy(false);
    if (error) { setError(error.code === "P0001" ? error.message : "Senden fehlgeschlagen. Bitte versuche es später erneut."); return; }
    // best-effort owner mail; never blocks or fails the form
    void invokeFn("notify-admin", { kind: "contact", id }).catch(() => {});
    setSent(true);
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      <h1 className="text-5xl font-black lowercase leading-[0.95] sm:text-6xl">
        <span className="text-primary">sag </span><span className="italic text-secondary">hallo.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
        frage, sonderwunsch oder großbestellung? schreib uns — wir melden uns schnell.
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <div className="space-y-4 text-sm">
          <p className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary" /> Ballindamm 40, 20095 Hamburg
          </p>
          <a href="mailto:info@private-shirt.de" className="flex items-center gap-3 hover:text-primary">
            <Mail className="h-5 w-5 text-primary" /> info@private-shirt.de
          </a>
          <a href="tel:+494032873804" className="flex items-center gap-3 hover:text-primary">
            <Phone className="h-5 w-5 text-primary" /> 040 – 328 73 804
          </a>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-card">
          {sent ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="mt-3 font-semibold">Danke für deine Nachricht!</p>
              <p className="mt-1 text-sm text-muted-foreground">Wir melden uns zeitnah bei dir.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="relative space-y-4">
              <Honeypot />
              <div className="space-y-1.5">
                <Label htmlFor="kt-name">Name</Label>
                <Input id="kt-name" autoComplete="name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kt-email">E-Mail</Label>
                <Input id="kt-email" autoComplete="email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kt-msg">Nachricht</Label>
                <textarea
                  id="kt-msg"
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Senden…" : "Nachricht senden"}
              </Button>
              <PrivacyNote />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
