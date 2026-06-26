import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function fetchSizes() {
  const { data, error } = await supabase.from("sizes").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data;
}

export default function Sizes() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["sizes"], queryFn: fetchSizes });
  const [name, setName] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sizes").insert({ name, sort_order: (data?.length ?? 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["sizes"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sizes"] }),
  });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Größen</h1>
      <p className="mb-6 text-sm text-muted-foreground">Global einmal anlegen, dann Produkten zuweisen.</p>

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
      {add.error && <p className="mb-4 text-sm text-destructive">{(add.error as Error).message}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data?.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 text-sm font-medium">{s.name}</span>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)} title="Löschen">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Noch keine Größen.</li>}
        </ul>
      )}
    </div>
  );
}
