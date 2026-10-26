import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dbErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDecimal } from "@/components/admin/csv";

async function fetchDiscounts() {
  const { data, error } = await supabase.from("volume_discounts").select("*").order("min_qty").order("discount_percent");
  if (error) throw error;
  return data;
}

/** Validated tier values or an error text. */
function parseTier(minQty: string, pct: string): { min_qty: number; discount_percent: number } | string {
  if (!/^[1-9]\d*$/.test(minQty.trim())) return "Menge: ganze Zahl ab 1.";
  const p = parseDecimal(pct);
  if (!(p > 0 && p <= 100)) return "Rabatt: mehr als 0 und höchstens 100 %.";
  return { min_qty: Number(minQty), discount_percent: p };
}

const tierError = (e: unknown) =>
  (e as { code?: string })?.code === "23505" ? "Für diese Menge gibt es schon eine Rabattstufe." : dbErrorMessage(e);

export default function Discounts() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["discounts"], queryFn: fetchDiscounts });
  const [minQty, setMinQty] = useState("");
  const [pct, setPct] = useState("");
  const [editing, setEditing] = useState<{ id: string; minQty: string; pct: string } | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["discounts"] });

  const add = useMutation({
    mutationFn: async () => {
      const tier = parseTier(minQty, pct);
      if (typeof tier === "string") throw new Error(tier);
      // One tier per quantity: an existing one is updated after confirmation.
      const existing = data?.find((d) => d.min_qty === tier.min_qty);
      if (existing) {
        if (!confirm(`Ab ${tier.min_qty} Stück gibt es schon ${Number(existing.discount_percent)} % Rabatt. Durch ${tier.discount_percent} % ersetzen?`)) return false;
        const { error } = await supabase.from("volume_discounts").update(tier).eq("id", existing.id);
        if (error) throw new Error(tierError(error));
      } else {
        const { error } = await supabase.from("volume_discounts").insert(tier);
        if (error) throw new Error(tierError(error));
      }
      return true;
    },
    onSuccess: (saved) => {
      if (!saved) return;
      setMinQty("");
      setPct("");
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: async (e: { id: string; minQty: string; pct: string }) => {
      const tier = parseTier(e.minQty, e.pct);
      if (typeof tier === "string") throw new Error(tier);
      const { error } = await supabase.from("volume_discounts").update(tier).eq("id", e.id);
      if (error) throw new Error(tierError(error));
    },
    onSuccess: () => { setEditing(null); invalidate(); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("volume_discounts").delete().eq("id", id);
      if (error) throw new Error(dbErrorMessage(error));
    },
    onSuccess: invalidate,
  });

  const counts = new Map<number, number>();
  data?.forEach((d) => counts.set(d.min_qty, (counts.get(d.min_qty) ?? 0) + 1));
  const error = (add.error as Error | null)?.message ?? (update.error as Error | null)?.message ?? (remove.error as Error | null)?.message;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Mengenrabatte</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Ab welcher Gesamtmenge im Warenkorb welcher Rabatt gilt. Produkte mit „vom Mengenrabatt
        ausschließen" zählen nicht mit. Es gilt immer die höchste erreichte Stufe.
      </p>

      <form
        className="mb-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="d-qty">Ab Menge</Label>
          <Input id="d-qty" type="number" min={1} step={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} className="w-28" placeholder="10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-pct">Rabatt (%)</Label>
          <Input id="d-pct" type="number" min={0.5} max={100} step="0.5" value={pct} onChange={(e) => setPct(e.target.value)} className="w-28" placeholder="5" />
        </div>
        <Button type="submit" disabled={add.isPending || !minQty || !pct}>
          Hinzufügen
        </Button>
      </form>
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data?.map((d) =>
            editing?.id === d.id ? (
              <li key={d.id} className="px-4 py-3">
                <form
                  className="flex flex-wrap items-center gap-2 text-sm"
                  onSubmit={(e) => { e.preventDefault(); update.mutate(editing); }}
                >
                  ab
                  <Input aria-label="Ab Menge" type="number" min={1} step={1} value={editing.minQty} onChange={(e) => setEditing({ ...editing, minQty: e.target.value })} className="h-9 w-24" />
                  Stück →
                  <Input aria-label="Rabatt in Prozent" type="number" min={0.5} max={100} step="0.5" value={editing.pct} onChange={(e) => setEditing({ ...editing, pct: e.target.value })} className="h-9 w-24" />
                  %
                  <Button type="submit" size="sm" disabled={update.isPending}>Speichern</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(null); update.reset(); }}>Abbrechen</Button>
                </form>
              </li>
            ) : (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 text-sm">
                  ab <strong>{d.min_qty}</strong> Stück →{" "}
                  <strong className="text-primary">{Number(d.discount_percent)}%</strong> Rabatt
                  {(counts.get(d.min_qty) ?? 0) > 1 && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">doppelt – bitte eine Stufe löschen</span>
                  )}
                </span>
                <Button variant="ghost" size="icon" onClick={() => { update.reset(); setEditing({ id: d.id, minQty: String(d.min_qty), pct: String(Number(d.discount_percent)) }); }} title="Bearbeiten">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => confirm(`Rabattstufe „ab ${d.min_qty} Stück → ${Number(d.discount_percent)} %“ wirklich löschen?`) && remove.mutate(d.id)}
                  title="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            )
          )}
          {data?.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">Noch keine Rabattstufen.</li>
          )}
        </ul>
      )}
    </div>
  );
}
