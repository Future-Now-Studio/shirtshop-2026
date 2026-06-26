import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function fetchProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, status, base_price, variants(id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export default function Products() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-products"], queryFn: fetchProducts });
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({ name, slug: slugify(name) });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (p: { id: string; status: string }) => {
      const next = p.status === "published" ? "draft" : "published";
      const { error } = await supabase.from("products").update({ status: next }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Produkte</h1>
      <p className="mb-6 text-sm text-muted-foreground">Bis zu 50 Produkte, je bis 20 Farb-Varianten.</p>

      <form
        className="mb-6 flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neues Produkt – Name" className="max-w-xs" />
        <Button type="submit" disabled={create.isPending || !name.trim()}>
          Anlegen
        </Button>
      </form>
      {create.error && <p className="mb-4 text-sm text-destructive">{(create.error as Error).message}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data?.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.variants?.length ?? 0} Varianten · {Number(p.base_price).toFixed(2)} €
                </p>
              </div>
              <button
                onClick={() => toggleStatus.mutate({ id: p.id, status: p.status })}
                className={
                  "rounded-full px-2.5 py-0.5 text-xs font-medium " +
                  (p.status === "published"
                    ? "bg-green-100 text-green-800"
                    : "bg-secondary text-secondary-foreground")
                }
                title="Status umschalten"
              >
                {p.status === "published" ? "veröffentlicht" : "Entwurf"}
              </button>
            </li>
          ))}
          {data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Noch keine Produkte.</li>}
        </ul>
      )}
    </div>
  );
}
