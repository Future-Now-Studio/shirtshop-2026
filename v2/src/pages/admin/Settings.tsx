import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

async function fetchSettings() {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export default function Settings() {
  const { data, error, refetch } = useQuery({ queryKey: ["admin-settings"], queryFn: fetchSettings });
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (data) setF(data); }, [data]);

  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  async function save() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("settings").update({
      design_element_price: Number(f.design_element_price),
      shipping_flat: Number(f.shipping_flat),
      free_shipping_threshold: Number(f.free_shipping_threshold),
      vat_rate: Number(f.vat_rate),
      order_email: f.order_email || null,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    setMsg(error ? "Fehler: " + error.message : "Gespeichert.");
    if (!error) refetch();
  }

  if (error) return <p className="text-destructive">Spalten fehlen? SETUP_ALL.sql ausführen. ({(error as Error).message})</p>;
  if (!f) return <p className="text-muted-foreground">Lade…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold">Einstellungen</h1>
      <p className="mb-6 text-sm text-muted-foreground">Globale Shop-Konfiguration. Wirkt auf Checkout & Rechnungen.</p>

      <div className="space-y-5 rounded-xl border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Versandkosten (€)</Label>
            <Input type="number" step="0.01" value={f.shipping_flat ?? ""} onChange={(e) => set("shipping_flat", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gratisversand ab (€)</Label>
            <Input type="number" step="0.01" value={f.free_shipping_threshold ?? ""} onChange={(e) => set("free_shipping_threshold", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>MwSt-Satz (0.19 = 19 %)</Label>
            <Input type="number" step="0.01" value={f.vat_rate ?? ""} onChange={(e) => set("vat_rate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Preis je Design-Element (€)</Label>
            <Input type="number" step="0.01" value={f.design_element_price ?? ""} onChange={(e) => set("design_element_price", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Bestell-Benachrichtigung an (E-Mail)</Label>
          <Input type="email" placeholder="bestellungen@private-shirt.de" value={f.order_email ?? ""} onChange={(e) => set("order_email", e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>{busy ? "speichere…" : "speichern"}</Button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Hinweis: Der Checkout nutzt diese Werte, sobald die Edge Functions die Settings lesen (Deploy).</p>
    </div>
  );
}
