import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dbErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { moveItem, saveOrder } from "@/components/admin/catalog";

async function fetchColors() {
  const { data, error } = await supabase.from("colors").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data;
}

export default function Colors() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["colors"], queryFn: fetchColors });
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#000000");
  const [editing, setEditing] = useState<{ id: string; name: string; hex: string } | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["colors"] });

  const add = useMutation({
    mutationFn: async () => {
      const last = data?.reduce((m, c) => Math.max(m, c.sort_order), 0) ?? 0;
      const { error } = await supabase.from("colors").insert({ name: name.trim(), hex, sort_order: last + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setHex("#000000");
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: async (c: { id: string; name: string; hex: string }) => {
      if (!c.name.trim()) throw new Error("Name fehlt.");
      const { error } = await supabase.from("colors").update({ name: c.name.trim(), hex: c.hex }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => { setEditing(null); invalidate(); },
  });

  const reorder = useMutation({
    mutationFn: (list: { id: string; sort_order: number }[]) => saveOrder("colors", list),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Farben</h1>
      <p className="mb-6 text-sm text-muted-foreground">Global einmal anlegen, dann Produkten zuweisen. Die Farbreihenfolge im Shop legst du je Produkt unter „Varianten & Bilder“ fest.</p>

      <form
        className="mb-6 flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="cname">Name</Label>
          <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Schwarz" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="chex">Farbe</Label>
          <input
            id="chex"
            type="color"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded-md border border-input bg-background"
          />
        </div>
        <Button type="submit" disabled={add.isPending || !name.trim()}>
          Hinzufügen
        </Button>
      </form>
      {add.error && <p className="mb-4 text-sm text-destructive">{dbErrorMessage(add.error)}</p>}
      {update.error && <p role="alert" className="mb-4 text-sm text-destructive">Speichern fehlgeschlagen: {dbErrorMessage(update.error)}</p>}
      {reorder.error && <p role="alert" className="mb-4 text-sm text-destructive">Sortieren fehlgeschlagen: {dbErrorMessage(reorder.error)}</p>}
      {remove.error && <p role="alert" className="mb-4 text-sm text-destructive">Löschen fehlgeschlagen: {dbErrorMessage(remove.error)}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data?.map((c, i) =>
            editing?.id === c.id ? (
              <li key={c.id} className="px-4 py-2.5">
                <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); update.mutate(editing); }}>
                  <input
                    type="color"
                    aria-label="Farbwert"
                    value={/^#[0-9a-f]{6}$/i.test(editing.hex) ? editing.hex : "#000000"}
                    onChange={(e) => setEditing({ ...editing, hex: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background"
                  />
                  <Input aria-label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-9 max-w-xs flex-1" autoFocus />
                  <Button type="submit" size="sm" disabled={update.isPending}>Speichern</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(null); update.reset(); }}>Abbrechen</Button>
                </form>
              </li>
            ) : (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: c.hex }} />
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{c.hex}</span>
                <div className="flex">
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0 || reorder.isPending} onClick={() => reorder.mutate(moveItem(data, i, -1))} title="Nach oben">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === data.length - 1 || reorder.isPending} onClick={() => reorder.mutate(moveItem(data, i, 1))} title="Nach unten">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { update.reset(); setEditing({ id: c.id, name: c.name, hex: c.hex }); }} title="Umbenennen / Farbwert ändern">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => confirm(`Farbe „${c.name}“ wirklich löschen?`) && remove.mutate(c.id)} title="Löschen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            )
          )}
          {data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Noch keine Farben.</li>}
        </ul>
      )}
    </div>
  );
}
