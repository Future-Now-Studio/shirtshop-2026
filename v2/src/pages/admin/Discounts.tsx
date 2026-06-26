import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function fetchDiscounts() {
  const { data, error } = await supabase.from("volume_discounts").select("*").order("min_qty");
  if (error) throw error;
  return data;
}

export default function Discounts() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["discounts"], queryFn: fetchDiscounts });
  const [minQty, setMinQty] = useState("");
  const [pct, setPct] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("volume_discounts")
        .insert({ min_qty: Number(minQty), discount_percent: Number(pct) });
      if (error) throw error;
    },
    onSuccess: () => {
      setMinQty("");
      setPct("");
      qc.invalidateQueries({ queryKey: ["discounts"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("volume_discounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["discounts"] }),
  });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Mengenrabatte</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Ab welcher Gesamtmenge im Warenkorb welcher Rabatt gilt. Produkte mit „vom Mengenrabatt
        ausschließen" zählen nicht mit.
      </p>

      <form
        className="mb-6 flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(minQty) > 0) add.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label>Ab Menge</Label>
          <Input type="number" min={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} className="w-28" placeholder="10" />
        </div>
        <div className="space-y-1.5">
          <Label>Rabatt (%)</Label>
          <Input type="number" min={0} max={100} step="0.5" value={pct} onChange={(e) => setPct(e.target.value)} className="w-28" placeholder="5" />
        </div>
        <Button type="submit" disabled={add.isPending || !minQty || !pct}>
          Hinzufügen
        </Button>
      </form>
      {add.error && <p className="mb-4 text-sm text-destructive">{(add.error as Error).message}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data?.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 text-sm">
                ab <strong>{d.min_qty}</strong> Stück →{" "}
                <strong className="text-primary">{Number(d.discount_percent)}%</strong> Rabatt
              </span>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(d.id)} title="Löschen">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {data?.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">Noch keine Rabattstufen.</li>
          )}
        </ul>
      )}
    </div>
  );
}
