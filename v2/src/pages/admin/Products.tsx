import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const CSV_COLS = ["id", "slug", "name", "category", "base_price", "design_element_price", "status", "excluded_from_volume_discount"];

async function exportCsv() {
  const { data } = await supabase.from("products").select(CSV_COLS.join(",")).order("name");
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [CSV_COLS.join(";"), ...(data ?? []).map((p: any) => CSV_COLS.map((c) => esc(p[c])).join(";"))];
  const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "produkte.csv"; a.click();
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (l: string) => l.match(/("([^"]|"")*"|[^;]*)(;|$)/g)!.slice(0, -1).map((c) => c.replace(/;$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
  const header = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [header[i], v])));
}

async function importCsv(file: File): Promise<string> {
  const rows = parseCsv(await file.text());
  let updated = 0;
  for (const r of rows) {
    const patch: any = {};
    if (r.name) patch.name = r.name;
    if ("category" in r) patch.category = r.category || null;
    if (r.base_price !== undefined && r.base_price !== "") patch.base_price = Number(r.base_price);
    if (r.design_element_price !== undefined && r.design_element_price !== "") patch.design_element_price = Number(r.design_element_price);
    if (r.status && ["draft", "published"].includes(r.status)) patch.status = r.status;
    if (r.excluded_from_volume_discount !== undefined && r.excluded_from_volume_discount !== "")
      patch.excluded_from_volume_discount = /^(true|1|ja|yes)$/i.test(r.excluded_from_volume_discount);
    if (!Object.keys(patch).length) continue;
    const q = r.id ? supabase.from("products").update(patch).eq("id", r.id)
                   : r.slug ? supabase.from("products").update(patch).eq("slug", r.slug) : null;
    if (q) { const { error } = await q; if (!error) updated++; }
  }
  return `${updated} von ${rows.length} Produkten aktualisiert.`;
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
  const [csvMsg, setCsvMsg] = useState<string | null>(null);

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
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Produkte</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            <Download className="h-4 w-4" /> CSV-Export
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" /> CSV-Import
            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              setCsvMsg("importiere…");
              const res = await importCsv(file);
              setCsvMsg(res); qc.invalidateQueries({ queryKey: ["admin-products"] }); e.target.value = "";
            }} />
          </label>
        </div>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">Bis zu 50 Produkte, je bis 20 Farb-Varianten.</p>
      {csvMsg && <p className="mb-4 text-sm text-muted-foreground">{csvMsg}</p>}

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
              <Link to={`/admin/products/${p.id}`} className="flex-1 hover:underline">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground no-underline">
                  {p.variants?.length ?? 0} Varianten · {Number(p.base_price).toFixed(2)} €
                </p>
              </Link>
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
