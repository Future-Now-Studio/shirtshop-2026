import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VariantManager from "@/components/admin/VariantManager";
import SizeMatrix from "@/components/admin/SizeMatrix";
import PrintZoneEditor from "@/components/admin/PrintZoneEditor";

const TABS = [
  { key: "basics", label: "Basis" },
  { key: "variants", label: "Varianten & Bilder" },
  { key: "sizes", label: "Größen & Bestand" },
  { key: "zones", label: "Druckzonen" },
] as const;

async function fetchProduct(id: string) {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: product, isLoading } = useQuery({ queryKey: ["product", id], queryFn: () => fetchProduct(id!) });
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("basics");

  if (isLoading) return <p className="text-muted-foreground">Lade…</p>;
  if (!product) return <p className="text-destructive">Produkt nicht gefunden.</p>;

  return (
    <div className="max-w-4xl">
      <Link to="/admin/products" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Zurück
      </Link>
      <h1 className="mb-1 text-2xl font-semibold">{product.name}</h1>
      <p className="mb-6 text-sm text-muted-foreground">/{product.slug}</p>

      <div className="mb-6 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "-mb-px border-b-2 px-4 py-2 text-sm " +
              (tab === t.key ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "basics" && <Basics product={product} onSaved={() => qc.invalidateQueries({ queryKey: ["product", id] })} />}
      {tab === "variants" && <VariantManager productId={product.id} />}
      {tab === "sizes" && <SizeMatrix productId={product.id} />}
      {tab === "zones" && <PrintZoneEditor productId={product.id} />}
    </div>
  );
}

function Basics({ product, onSaved }: { product: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: product.name ?? "",
    category: product.category ?? "",
    description: product.description ?? "",
    base_price: product.base_price ?? 0,
    design_element_price: product.design_element_price ?? 0,
    status: product.status ?? "draft",
    excluded_from_volume_discount: product.excluded_from_volume_discount ?? false,
  });
  useEffect(() => {
    setForm({
      name: product.name ?? "",
      category: product.category ?? "",
      description: product.description ?? "",
      base_price: product.base_price ?? 0,
      design_element_price: product.design_element_price ?? 0,
      status: product.status ?? "draft",
      excluded_from_volume_discount: product.excluded_from_volume_discount ?? false,
    });
  }, [product.id]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("products")
        .update({
          name: form.name,
          category: form.category || null,
          description: form.description || null,
          base_price: Number(form.base_price),
          design_element_price: Number(form.design_element_price),
          status: form.status,
          excluded_from_volume_discount: form.excluded_from_volume_discount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: onSaved,
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Kategorie</Label>
        <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="z.B. shirts" />
      </div>
      <div className="space-y-1.5">
        <Label>Beschreibung</Label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-4">
        <div className="space-y-1.5">
          <Label>Basispreis (€)</Label>
          <Input type="number" step="0.01" min="0" value={form.base_price} onChange={(e) => set("base_price", e.target.value)} className="w-36" />
        </div>
        <div className="space-y-1.5">
          <Label>Preis je Design-Element (€)</Label>
          <Input type="number" step="0.01" min="0" value={form.design_element_price} onChange={(e) => set("design_element_price", e.target.value)} className="w-44" />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className="h-10 w-40 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="draft">Entwurf</option>
            <option value="published">Veröffentlicht</option>
          </select>
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.excluded_from_volume_discount}
            onChange={(e) => set("excluded_from_volume_discount", e.target.checked)}
          />
          Vom Mengenrabatt ausschließen
        </label>
      </div>
      {save.error && <p className="text-sm text-destructive">{(save.error as Error).message}</p>}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Speichern…" : save.isSuccess ? "Gespeichert ✓" : "Speichern"}
      </Button>
    </form>
  );
}
