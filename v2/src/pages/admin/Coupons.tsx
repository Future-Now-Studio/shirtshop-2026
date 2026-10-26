import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { dbErrorMessage, eur } from "@/lib/utils";
import { parseDecimal } from "@/components/admin/csv";

async function fetchCoupons() {
  const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

const empty = { code: "", kind: "percent", value: "10", min_order: "0", max_uses: "", valid_until: "" };

/** "2026-12-31" → end of that day in Berlin as ISO (22:59:59Z in winter, 21:59:59Z in summer). */
function berlinEndOfDay(date: string): string {
  const guess = new Date(`${date}T23:59:59Z`);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(guess).map((x) => [x.type, Number(x.value)])
  );
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess.getTime(); // +1 h / +2 h
  return new Date(guess.getTime() - offset).toISOString();
}

const todayBerlin = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); // YYYY-MM-DD

/** Why the form cannot be saved (null = ok). */
function formProblem(f: typeof empty): string | null {
  if (!/^[A-Z0-9][A-Z0-9_-]{2,29}$/.test(f.code.trim().toUpperCase()))
    return "Code: 3–30 Zeichen, nur Buchstaben A–Z, Ziffern, - und _.";
  const value = parseDecimal(f.value);
  if (f.kind === "percent" && !(value > 0 && value <= 100)) return "Prozent-Rabatt muss zwischen 0 und 100 liegen.";
  if (f.kind === "fixed" && !(value > 0)) return "Euro-Rabatt muss größer als 0 sein.";
  const minOrder = f.min_order.trim() === "" ? 0 : parseDecimal(f.min_order);
  if (!(minOrder >= 0)) return "Mindestbestellwert darf nicht negativ sein.";
  if (f.max_uses.trim() !== "" && !/^[1-9]\d*$/.test(f.max_uses.trim())) return "Max. Nutzungen: ganze Zahl ab 1 oder leer (unbegrenzt).";
  if (f.valid_until && f.valid_until < todayBerlin()) return "„Gültig bis“ liegt in der Vergangenheit.";
  return null;
}

function couponState(c: any): string | null {
  if (!c.active) return "inaktiv";
  if (c.valid_until && new Date(c.valid_until).getTime() < Date.now()) return "abgelaufen";
  if (c.max_uses != null && c.used_count >= c.max_uses) return "aufgebraucht";
  return null;
}

export default function Coupons() {
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["admin-coupons"], queryFn: fetchCoupons });
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-coupons"] });

  async function create() {
    const problem = formProblem(f);
    if (problem) { setMsg(problem); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("coupons").insert({
      code: f.code.trim().toUpperCase(),
      kind: f.kind,
      value: parseDecimal(f.value),
      min_order: f.min_order.trim() === "" ? 0 : parseDecimal(f.min_order),
      max_uses: f.max_uses.trim() ? Number(f.max_uses) : null,
      valid_until: f.valid_until ? berlinEndOfDay(f.valid_until) : null,
    });
    setBusy(false);
    if (error) { setMsg(error.code === "23505" ? "Diesen Code gibt es schon." : "Fehler: " + dbErrorMessage(error)); return; }
    setF(empty); invalidate();
  }
  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("coupons").update({ active }).eq("id", id);
    if (error) setMsg("Ändern fehlgeschlagen: " + dbErrorMessage(error));
    invalidate();
  }
  async function remove(c: { id: string; code: string; used_count: number }) {
    const used = c.used_count > 0 ? ` Er wurde schon ${c.used_count}× eingelöst – zum Beenden reicht auch „aktiv“ abwählen.` : "";
    if (!confirm(`Gutschein „${c.code}“ wirklich löschen?${used}`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", c.id);
    if (error) setMsg("Löschen fehlgeschlagen: " + dbErrorMessage(error));
    invalidate();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Gutscheine</h1>
      <p className="mb-6 text-sm text-muted-foreground">Rabattcodes für den Checkout. Werden serverseitig validiert. „Gültig bis“ gilt bis 23:59 Uhr des Tages.</p>

      {error && <p className="mb-4 text-destructive">Gutscheine konnten nicht geladen werden ({dbErrorMessage(error)}). Fehlen Datenbank-Migrationen? → <code>supabase db push</code></p>}

      {/* Create */}
      <form
        className="mb-8 grid items-end gap-3 rounded-xl border bg-card p-4 sm:grid-cols-6"
        onSubmit={(e) => { e.preventDefault(); create(); }}
      >
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="c-code">Code</Label><Input id="c-code" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="SOMMER10" maxLength={30} /></div>
        <div className="space-y-1.5"><Label htmlFor="c-kind">Typ</Label>
          <select id="c-kind" className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="percent">%</option><option value="fixed">€</option>
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="c-value">Wert</Label><Input id="c-value" type="number" min={0.01} max={f.kind === "percent" ? 100 : undefined} step="0.01" value={f.value} onChange={(e) => set("value", e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="c-min">Min. Bestellwert</Label><Input id="c-min" type="number" min={0} step="0.01" value={f.min_order} onChange={(e) => set("min_order", e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="c-max">Max. Nutzungen</Label><Input id="c-max" type="number" min={1} step={1} value={f.max_uses} onChange={(e) => set("max_uses", e.target.value)} placeholder="∞" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="c-until">Gültig bis</Label><Input id="c-until" type="date" min={todayBerlin()} value={f.valid_until} onChange={(e) => set("valid_until", e.target.value)} /></div>
        <Button type="submit" disabled={busy} className="sm:col-span-1">anlegen</Button>
      </form>
      {msg && <p role="alert" className="mb-3 text-sm text-destructive">{msg}</p>}

      <ul className="divide-y rounded-xl border">
        {data?.map((c: any) => {
          const state = couponState(c);
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="font-mono font-bold">{c.code}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs">{c.kind === "percent" ? `${Number(c.value)}%` : `${eur(Number(c.value))}`}</span>
              {state && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{state}</span>}
              <span className="text-xs text-muted-foreground">
                {Number(c.min_order) > 0 && `ab ${eur(Number(c.min_order))} · `}
                {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""} genutzt
                {c.valid_until && ` · bis ${new Date(c.valid_until).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`}
              </span>
              <label className="ml-auto flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={c.active} onChange={(e) => toggle(c.id, e.target.checked)} /> aktiv
              </label>
              <button onClick={() => remove(c)} title="Löschen" aria-label={`Gutschein ${c.code} löschen`} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </li>
          );
        })}
        {data?.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">Noch keine Gutscheine.</li>}
      </ul>
    </div>
  );
}
