import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Star, Ruler, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

/* ---------- Size chart ---------- */
const SIZE_ROWS = [
  ["XS", "44", "62"], ["S", "48", "68"], ["M", "52", "72"], ["L", "56", "74"], ["XL", "60", "76"], ["XXL", "64", "78"],
];
export function SizeChartButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <Ruler className="h-4 w-4" /> Größentabelle
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold lowercase">größentabelle</h3>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Größe</th><th>Brustweite (cm)</th><th>Länge (cm)</th></tr></thead>
              <tbody>
                {SIZE_ROWS.map((r) => <tr key={r[0]} className="border-b last:border-0"><td className="py-2 font-medium">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">Richtwerte — je nach Schnitt und Marke können Maße leicht abweichen.</p>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Reviews ---------- */
function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= Math.round(n) ? "fill-secondary text-secondary" : "text-muted-foreground/40"}`} />
      ))}
    </span>
  );
}

async function fetchReviews(productId: string) {
  const { data, error } = await supabase.from("reviews").select("id, rating, name, text, created_at").eq("product_id", productId).eq("approved", true).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export function Reviews({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["reviews", productId], queryFn: () => fetchReviews(productId) });
  const [form, setForm] = useState({ name: "", rating: 5, text: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reviews = data ?? [];
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.text.trim()) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("reviews").insert({ product_id: productId, rating: form.rating, name: form.name.trim(), text: form.text.trim() });
    setBusy(false);
    if (error) { setMsg("Fehler: " + error.message); return; }
    setForm({ name: "", rating: 5, text: "" });
    setMsg("Danke! Deine Bewertung wird nach Prüfung veröffentlicht.");
    qc.invalidateQueries({ queryKey: ["reviews", productId] });
  }

  if (error) return null; // reviews table missing → hide section

  return (
    <section className="mt-16 border-t pt-10">
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-2xl font-bold lowercase">bewertungen</h2>
        {reviews.length > 0 && <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Stars n={avg} /> {avg.toFixed(1)} · {reviews.length}</span>}
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="space-y-4">
          {reviews.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Bewertungen — sei die/der Erste!</p>}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.name}</span>
                <Stars n={r.rating} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{r.text}</p>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-5">
          <p className="font-semibold lowercase">bewertung schreiben</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button type="button" key={i} onClick={() => setForm((f) => ({ ...f, rating: i }))}>
                <Star className={"h-6 w-6 " + (i <= form.rating ? "fill-secondary text-secondary" : "text-muted-foreground/40")} />
              </button>
            ))}
          </div>
          <input required placeholder="Dein Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          <textarea required rows={3} placeholder="Wie findest du das Produkt?" value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <Button type="submit" disabled={busy}>{busy ? "senden…" : "absenden"}</Button>
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        </form>
      </div>
    </section>
  );
}

/* ---------- Similar products ---------- */
async function fetchSimilar(category: string | null, excludeId: string) {
  let q = supabase.from("products").select("id, slug, name, base_price, variants(hex, colors(hex), variant_images(view, storage_path))").eq("status", "published").neq("id", excludeId).limit(4);
  if (category) q = q.eq("category", category);
  const { data } = await q;
  return data ?? [];
}

export function SimilarProducts({ category, excludeId }: { category: string | null; excludeId: string }) {
  const { data } = useQuery({ queryKey: ["similar", category, excludeId], queryFn: () => fetchSimilar(category, excludeId) });
  if (!data || data.length === 0) return null;
  return (
    <section className="mt-16 border-t pt-10">
      <h2 className="mb-6 text-2xl font-bold lowercase">das könnte dir auch gefallen</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((p: any) => {
          const img = (p.variants ?? [])[0]?.variant_images?.find((i: any) => i.view === "front");
          const url = img ? supabase.storage.from("product-images").getPublicUrl(img.storage_path).data.publicUrl : null;
          return (
            <Link key={p.id} to={`/produkt/${p.slug}`} className="hover-lift group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-white">
                {url ? <img src={url} alt={p.name} className="h-full w-full object-contain p-3" /> : <div className="flex h-full w-full">{(p.variants ?? []).slice(0, 5).map((v: any, i: number) => <div key={i} className="h-full flex-1" style={{ backgroundColor: v.hex ?? v.colors?.hex }} />)}</div>}
              </div>
              <div className="p-4">
                <h3 className="truncate text-sm font-bold group-hover:text-primary">{p.name}</h3>
                <span className="text-sm font-bold text-primary">{Number(p.base_price).toFixed(2)} €</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
