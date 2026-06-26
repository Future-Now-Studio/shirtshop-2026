import { useState } from "react";
import { Mail, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Kontakt() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("contact_messages").insert({
      name: form.name,
      email: form.email,
      message: form.message,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Kontakt</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Frage, Sonderwunsch oder Großbestellung? Schreib uns — wir melden uns schnell.
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <div className="space-y-4 text-sm">
          <p className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary" /> Ballindamm 40, 20095 Hamburg
          </p>
          <a href="mailto:info@private-shirt.de" className="flex items-center gap-3 hover:text-primary">
            <Mail className="h-5 w-5 text-primary" /> info@private-shirt.de
          </a>
          <p className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-primary" /> 040 – 328 73 804
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-card">
          {sent ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="mt-3 font-semibold">Danke für deine Nachricht!</p>
              <p className="mt-1 text-sm text-muted-foreground">Wir melden uns zeitnah bei dir.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>E-Mail</Label>
                <Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Nachricht</Label>
                <textarea
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
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
