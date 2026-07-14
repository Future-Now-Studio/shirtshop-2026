import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

async function fetchCoupons() {
  const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

const empty = { code: "", kind: "percent", value: "10", min_order: "0", max_uses: "", valid_until: "" };

export default function Coupons() {
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["admin-coupons"], queryFn: fetchCoupons });
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-coupons"] });

  async function create() {
    if (!f.code.trim()) { setMsg("Code fehlt."); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("coupons").insert({
      code: f.code.trim().toUpperCase(),
      kind: f.kind,
      value: Number(f.value),
      min_order: Number(f.min_order || 0),
      max_uses: f.max_uses ? Number(f.max_uses) : null,
      valid_until: f.valid_until ? new Date(f.valid_until).toISOString() : null,
    });
    setBusy(false);
    if (error) { setMsg("Fehler: " + error.message); return; }
    setF(empty); invalidate();
  }
  async function toggle(id: string, active: boolean) { await supabase.from("coupons").update({ active }).eq("id", id); invalidate(); }
  async function remove(id: string) { await supabase.from("coupons").delete().eq("id", id); invalidate(); }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Gutscheine</h1>
      <p className="mb-6 text-sm text-muted-foreground">Rabattcodes für den Checkout. Werden serverseitig validiert.</p>

      {error && <p className="mb-4 text-destructive">Tabelle fehlt? SETUP_ALL.sql ausführen.</p>}

      {/* Create */}
      <div className="mb-8 grid items-end gap-3 rounded-xl border bg-card p-4 sm:grid-cols-6">
        <div className="space-y-1.5 sm:col-span-2"><Label>Code</Label><Input value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="SOMMER10" /></div>
        <div className="space-y-1.5"><Label>Typ</Label>
          <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="percent">%</option><option value="fixed">€</option>
          </select>
        </div>
        <div className="space-y-1.5"><Label>Wert</Label><Input type="number" value={f.value} onChange={(e) => set("value", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Min. Bestellwert</Label><Input type="number" value={f.min_order} onChange={(e) => set("min_order", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Max. Nutzungen</Label><Input type="number" value={f.max_uses} onChange={(e) => set("max_uses", e.target.value)} placeholder="∞" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Gültig bis</Label><Input type="date" value={f.valid_until} onChange={(e) => set("valid_until", e.target.value)} /></div>
        <Button onClick={create} disabled={busy} className="sm:col-span-1">anlegen</Button>
      </div>
      {msg && <p className="mb-3 text-sm text-muted-foreground">{msg}</p>}

      <ul className="divide-y rounded-xl border">
        {data?.map((c: any) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="font-mono font-bold">{c.code}</span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs">{c.kind === "percent" ? `${c.value}%` : `${Number(c.value).toFixed(2)} €`}</span>
            <span className="text-xs text-muted-foreground">
              {Number(c.min_order) > 0 && `ab ${Number(c.min_order).toFixed(0)} € · `}
              {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""} genutzt
              {c.valid_until && ` · bis ${new Date(c.valid_until).toLocaleDateString("de-DE")}`}
            </span>
            <label className="ml-auto flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={c.active} onChange={(e) => toggle(c.id, e.target.checked)} /> aktiv
            </label>
            <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
        {data?.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">Noch keine Gutscheine.</li>}
      </ul>
    </div>
  );
}
