import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("colors").insert({ name, hex, sort_order: (data?.length ?? 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setHex("#000000");
      qc.invalidateQueries({ queryKey: ["colors"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colors"] }),
  });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Farben</h1>
      <p className="mb-6 text-sm text-muted-foreground">Global einmal anlegen, dann Produkten zuweisen.</p>

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
      {add.error && <p className="mb-4 text-sm text-destructive">{(add.error as Error).message}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data?.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="h-6 w-6 rounded-full border" style={{ backgroundColor: c.hex }} />
              <span className="flex-1 text-sm">{c.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{c.hex}</span>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(c.id)} title="Löschen">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Noch keine Farben.</li>}
        </ul>
      )}
    </div>
  );
}
