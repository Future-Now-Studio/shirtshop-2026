import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SHOP_CONFIG } from "@/lib/pricing";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

async function fetchSettings() {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// German number input may arrive as "4,90"; empty → NaN (rejected)
const toNumber = (v: unknown) => {
  const t = String(v ?? "").trim().replace(",", ".");
  return t === "" ? NaN : Number(t);
};

/** Validated update payload, or a German error message. */
function validate(f: any): { values: Record<string, unknown> } | { error: string } {
  const nums = {
    shipping_flat: toNumber(f.shipping_flat),
    free_shipping_threshold: toNumber(f.free_shipping_threshold),
    vat_rate: toNumber(f.vat_rate),
    design_element_price: toNumber(f.design_element_price),
  };
  if (Object.values(nums).some((n) => !Number.isFinite(n) || n < 0))
    return { error: "Bitte alle Beträge als Zahl ≥ 0 eintragen." };
  if (nums.vat_rate >= 1) return { error: "MwSt-Satz als Dezimalzahl angeben, z. B. 0.19 für 19 %." };
  const deliveryTime = String(f.delivery_time ?? "").trim();
  if (!deliveryTime) return { error: "Bitte eine Lieferzeit angeben (Pflichtangabe im Onlinehandel)." };
  if (deliveryTime.length > 200) return { error: "Die Lieferzeit darf höchstens 200 Zeichen lang sein." };
  const email = String(f.order_email ?? "").trim();
  if (email && !EMAIL_RE.test(email)) return { error: "Bitte eine gültige E-Mail-Adresse für Benachrichtigungen angeben." };
  const values: Record<string, unknown> = { ...nums, delivery_time: deliveryTime, order_email: email || null };
  // low-stock warning threshold (column from the admin-catalog migration; only if present)
  if ("low_stock_threshold" in f) {
    const t = toNumber(f.low_stock_threshold);
    if (!Number.isInteger(t) || t < 0 || t > 100000) return { error: "Lagerwarnung: bitte eine ganze Zahl zwischen 0 und 100000 eintragen." };
    values.low_stock_threshold = t;
  }
  return { values };
}

export default function Settings() {
  const qc = useQueryClient();
  const { data, error, refetch } = useQuery({ queryKey: ["admin-settings"], queryFn: fetchSettings });
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (data) setF(data); }, [data]);

  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const checked = validate(f);
    if ("error" in checked) { setMsg(checked.error); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("settings").update({
      ...checked.values,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    // 23514 = DB check constraint (same rules as above)
    setMsg(error ? (error.code === "23514" ? "Ungültiger Wert – bitte Eingaben prüfen." : "Fehler: " + error.message) : "Gespeichert.");
    if (!error) {
      refetch();
      qc.invalidateQueries({ queryKey: ["shop-config"] }); // storefront prices/Lieferzeit in this tab
    }
  }

  if (error) return <p className="text-destructive">Einstellungen konnten nicht geladen werden – sind alle Migrationen eingespielt? ({(error as Error).message})</p>;
  if (!f) return <p className="text-muted-foreground">Lade…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold">Einstellungen</h1>
      <p className="mb-6 text-sm text-muted-foreground">Globale Shop-Konfiguration. Wirkt auf Checkout & Rechnungen.</p>

      <form onSubmit={save} className="space-y-5 rounded-xl border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-shipping">Versandkosten (€)</Label>
            <Input id="set-shipping" type="number" required min={0} step="0.01" value={f.shipping_flat ?? ""} onChange={(e) => set("shipping_flat", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-free">Gratisversand ab (€)</Label>
            <Input id="set-free" type="number" required min={0} step="0.01" value={f.free_shipping_threshold ?? ""} onChange={(e) => set("free_shipping_threshold", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-vat">MwSt-Satz (0.19 = 19 %)</Label>
            <Input id="set-vat" type="number" required min={0} max={0.99} step="0.01" value={f.vat_rate ?? ""} onChange={(e) => set("vat_rate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-design">Standard-Preis je Design-Element (€) für neue Produkte</Label>
            <Input id="set-design" type="number" required min={0} step="0.01" value={f.design_element_price ?? ""} onChange={(e) => set("design_element_price", e.target.value)} />
          </div>
          {"low_stock_threshold" in f && (
            <div className="space-y-1.5">
              <Label htmlFor="set-lowstock">Lagerwarnung unter (Stück)</Label>
              <Input id="set-lowstock" type="number" required min={0} max={100000} step="1" value={f.low_stock_threshold ?? ""} onChange={(e) => set("low_stock_threshold", e.target.value)} />
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="set-delivery">Lieferzeit</Label>
          <Input id="set-delivery" required maxLength={200} placeholder={DEFAULT_SHOP_CONFIG.deliveryTime} value={f.delivery_time ?? ""} onChange={(e) => set("delivery_time", e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Pflichtangabe im Onlinehandel. Wird im Shop angezeigt, u. a. auf jeder Produktseite und auf der Startseite.
            Format: „3–5 Werktage“ – Zusätze nach einem Komma, z. B. „3–5 Werktage, mit individuellem Druck 5–10 Werktage“.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="set-email">Benachrichtigungen an (E-Mail)</Label>
          <Input id="set-email" type="email" placeholder="bestellungen@private-shirt.de" value={f.order_email ?? ""} onChange={(e) => set("order_email", e.target.value)} />
          <p className="text-xs text-muted-foreground">Neue Bestellungen, Großbestellungs-Anfragen, Kontakt-Nachrichten und Bewertungen (außer auf dem Server ist fest ORDER_EMAIL_TO hinterlegt).</p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? "speichere…" : "speichern"}</Button>
          {msg && <span className="text-sm text-muted-foreground" role="status">{msg}</span>}
        </div>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">Versandkosten, Gratisversand-Grenze und MwSt gelten sofort für Warenkorb, Kasse und Rechnungen. Der Preis je Design-Element wird pro Produkt gepflegt; dieser Wert ist nur die Vorgabe für neu angelegte Produkte.</p>
    </div>
  );
}
