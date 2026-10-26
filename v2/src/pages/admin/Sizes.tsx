import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { dbErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { moveItem, saveOrder } from "@/components/admin/catalog";

async function fetchSizes() {
  const { data, error } = await supabase.from("sizes").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data;
}

export default function Sizes() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["sizes"], queryFn: fetchSizes });
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sizes"] });

  const add = useMutation({
    mutationFn: async () => {
      const last = data?.reduce((m, s) => Math.max(m, s.sort_order), 0) ?? 0;
      const { error } = await supabase.from("sizes").insert({ name: name.trim(), sort_order: last + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      invalidate();
    },
  });

  const rename = useMutation({
    mutationFn: async (s: { id: string; name: string }) => {
      if (!s.name.trim()) throw new Error("Name fehlt.");
      const { error } = await supabase.from("sizes").update({ name: s.name.trim() }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => { setEditing(null); invalidate(); },
  });

  const reorder = useMutation({
    mutationFn: (list: { id: string; sort_order: number }[]) => saveOrder("sizes", list),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Größen</h1>
      <p className="mb-6 text-sm text-muted-foreground">Global einmal anlegen, dann Produkten zuweisen. In dieser Reihenfolge erscheinen die Größen im Shop.</p>

      <form
        className="mb-6 flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="sname">Name</Label>
          <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. M" className="w-32" />
        </div>
        <Button type="submit" disabled={add.isPending || !name.trim()}>
          Hinzufügen
        </Button>
      </form>
      {add.error && <p className="mb-4 text-sm text-destructive">{dbErrorMessage(add.error)}</p>}
      {rename.error && <p role="alert" className="mb-4 text-sm text-destructive">Speichern fehlgeschlagen: {dbErrorMessage(rename.error)}</p>}
      {reorder.error && <p role="alert" className="mb-4 text-sm text-destructive">Sortieren fehlgeschlagen: {dbErrorMessage(reorder.error)}</p>}
      {remove.error && <p role="alert" className="mb-4 text-sm text-destructive">Löschen fehlgeschlagen: {dbErrorMessage(remove.error)}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data?.map((s, i) =>
            editing?.id === s.id ? (
              <li key={s.id} className="px-4 py-2.5">
                <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); rename.mutate(editing); }}>
                  <Input aria-label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-9 w-32" autoFocus />
                  <Button type="submit" size="sm" disabled={rename.isPending}>Speichern</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(null); rename.reset(); }}>Abbrechen</Button>
                </form>
              </li>
            ) : (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-sm font-medium">{s.name}</span>
                <div className="flex">
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0 || reorder.isPending} onClick={() => reorder.mutate(moveItem(data, i, -1))} title="Nach oben">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === data.length - 1 || reorder.isPending} onClick={() => reorder.mutate(moveItem(data, i, 1))} title="Nach unten">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { rename.reset(); setEditing({ id: s.id, name: s.name }); }} title="Umbenennen">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => confirm(`Größe „${s.name}“ wirklich löschen?`) && remove.mutate(s.id)} title="Löschen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            )
          )}
          {data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Noch keine Größen.</li>}
        </ul>
      )}
    </div>
  );
}
