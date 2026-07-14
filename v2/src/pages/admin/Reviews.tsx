import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Check, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

async function fetchAll() {
  const { data, error } = await supabase.from("reviews").select("id, rating, name, text, approved, created_at, products(name)").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export default function Reviews() {
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["admin-reviews"], queryFn: fetchAll });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-reviews"] });

  async function approve(id: string, approved: boolean) { await supabase.from("reviews").update({ approved }).eq("id", id); invalidate(); }
  async function remove(id: string) { await supabase.from("reviews").delete().eq("id", id); invalidate(); }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Bewertungen</h1>
      <p className="mb-6 text-sm text-muted-foreground">Neue Bewertungen freigeben oder löschen.</p>
      {error && <p className="text-destructive">Tabelle fehlt? Reviews-SQL ausführen.</p>}
      <ul className="space-y-3">
        {(data ?? []).map((r: any) => (
          <li key={r.id} className={"rounded-xl border p-4 " + (r.approved ? "" : "border-amber-300 bg-amber-50/50")}>
            <div className="flex items-center gap-2">
              <span className="font-medium">{r.name}</span>
              <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={"h-3.5 w-3.5 " + (i <= r.rating ? "fill-secondary text-secondary" : "text-muted-foreground/40")} />)}</span>
              <span className="text-xs text-muted-foreground">· {r.products?.name}</span>
              {!r.approved && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">neu</span>}
              <div className="ml-auto flex gap-2">
                {!r.approved && <button onClick={() => approve(r.id, true)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"><Check className="h-3.5 w-3.5" /> freigeben</button>}
                {r.approved && <button onClick={() => approve(r.id, false)} className="rounded-md border px-2 py-1 text-xs hover:bg-accent">verbergen</button>}
                <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{r.text}</p>
          </li>
        ))}
        {data?.length === 0 && <li className="rounded-xl border px-4 py-10 text-center text-sm text-muted-foreground">Noch keine Bewertungen.</li>}
      </ul>
    </div>
  );
}
