import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Download, Trash2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { publishProblem } from "@/lib/publish-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dbErrorMessage, eur } from "@/lib/utils";
import { decimalDe, downloadCsv, parseCsv, parseDecimal } from "@/components/admin/csv";
import { deleteProduct, duplicateProduct, orderLineCount, slugify } from "@/components/admin/catalog";

const CSV_COLS = ["id", "slug", "name", "category", "base_price", "design_element_price", "status", "excluded_from_volume_discount"] as const;
const PRICE_COLS = { base_price: "Basispreis", design_element_price: "Preis je Design-Element" } as const;
const STATUS_VALUES: Record<string, "draft" | "published"> = {
  draft: "draft", entwurf: "draft", published: "published", "veröffentlicht": "published", veroeffentlicht: "published",
};

async function exportCsv() {
  const { data, error } = await supabase.from("products").select(CSV_COLS.join(",")).order("name");
  if (error) throw error;
  const rows = (data ?? []).map((p: any) =>
    CSV_COLS.map((c) =>
      c === "base_price" || c === "design_element_price" ? decimalDe(p[c])
        : c === "excluded_from_volume_discount" ? (p[c] ? "ja" : "nein")
        : p[c]
    )
  );
  downloadCsv("produkte.csv", [[...CSV_COLS], ...rows]);
}

interface ImportResult { updated: number; unchanged: number; total: number; errors: string[] }

/**
 * Updates EXISTING products (matched by id, else slug) from a CSV in the export
 * format. Rows with invalid values are skipped as a whole; a row that would
 * publish a product only does so if the product passes the publish check.
 */
async function importCsv(file: File): Promise<ImportResult> {
  const { header, rows } = parseCsv(await file.text());
  const result: ImportResult = { updated: 0, unchanged: 0, total: rows.length, errors: [] };
  if (!header.includes("id") && !header.includes("slug")) {
    result.errors.push("Spalte „id“ oder „slug“ fehlt. Bitte die Datei aus „CSV-Export“ als Vorlage nehmen (Trennzeichen ; oder ,).");
    return result;
  }
  const { data: products, error } = await supabase.from("products").select(CSV_COLS.join(","));
  if (error) throw error;
  const list = (products ?? []) as any[];
  const byId = new Map(list.map((p) => [p.id, p]));
  const bySlug = new Map(list.map((p) => [p.slug, p]));

  for (const [i, r] of rows.entries()) {
    const line = i + 2; // header is line 1
    const product = r.id ? byId.get(r.id) : r.slug ? bySlug.get(r.slug) : undefined;
    if (!product) {
      result.errors.push(`Zeile ${line}: Produkt ${r.id ? `mit id ${r.id}` : r.slug ? `„${r.slug}“` : "ohne id/slug"} nicht gefunden – der Import ändert nur bestehende Produkte.`);
      continue;
    }
    const label = `Zeile ${line} (${product.name})`;
    const patch: Record<string, unknown> = {};
    const problems: string[] = [];

    if (r.name && r.name !== product.name) patch.name = r.name;
    if ("category" in r && (r.category || null) !== (product.category || null)) patch.category = r.category || null;
    for (const col of Object.keys(PRICE_COLS) as (keyof typeof PRICE_COLS)[]) {
      if (!r[col]) continue;
      const n = parseDecimal(r[col]);
      if (Number.isNaN(n)) problems.push(`${PRICE_COLS[col]} „${r[col]}“ ist keine Zahl`);
      else if (n < 0) problems.push(`${PRICE_COLS[col]} darf nicht negativ sein`);
      else if (Math.round(n * 100) !== Math.round(Number(product[col]) * 100)) patch[col] = Math.round(n * 100) / 100;
    }
    const flag = r.excluded_from_volume_discount;
    if (flag) {
      const v = /^(true|1|ja|yes|x)$/i.test(flag) ? true : /^(false|0|nein|no)$/i.test(flag) ? false : null;
      if (v === null) problems.push(`„${flag}“ bei excluded_from_volume_discount: bitte ja oder nein`);
      else if (v !== product.excluded_from_volume_discount) patch.excluded_from_volume_discount = v;
    }
    const status = r.status ? STATUS_VALUES[r.status.toLowerCase()] : undefined;
    if (r.status && !status) problems.push(`Status „${r.status}“ unbekannt (draft oder published)`);

    if (problems.length) {
      result.errors.push(`${label}: ${problems.join("; ")} – Zeile nicht übernommen.`);
      continue;
    }
    if (status && status !== product.status) {
      const problem = status === "published" ? await publishProblem(product.id) : null;
      if (problem) result.errors.push(`${label}: nicht veröffentlicht – ${problem}`);
      else patch.status = status;
    }
    if (!Object.keys(patch).length) { result.unchanged++; continue; }

    const { error: upErr } = await supabase
      .from("products")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    if (upErr) result.errors.push(`${label}: ${dbErrorMessage(upErr)}`);
    else result.updated++;
  }
  return result;
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
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["admin-products"], queryFn: fetchProducts });
  const [name, setName] = useState("");
  const [csv, setCsv] = useState<{ text: string; errors: string[] } | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-products"] });

  const create = useMutation({
    mutationFn: async () => {
      const slug = slugify(name);
      if (!slug) throw new Error("Der Name braucht mindestens einen Buchstaben oder eine Ziffer.");
      // New products start with the default design price from the settings.
      const { data: cfg } = await supabase.from("settings").select("design_element_price").eq("id", 1).maybeSingle();
      const { error } = await supabase.from("products").insert({
        name: name.trim(),
        slug,
        design_element_price: Number(cfg?.design_element_price ?? 10),
      });
      if (error) {
        throw new Error(error.code === "23505"
          ? `Es gibt schon ein Produkt mit der Shop-Adresse „/produkt/${slug}“. Bitte einen anderen Namen wählen.`
          : dbErrorMessage(error));
      }
    },
    onSuccess: () => {
      setName("");
      invalidate();
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (p: { id: string; status: string }) => {
      const next = p.status === "published" ? "draft" : "published";
      if (next === "published") {
        const problem = await publishProblem(p.id);
        if (problem) throw new Error(`Noch nicht veröffentlichbar: ${problem}`);
      }
      const { error } = await supabase.from("products").update({ status: next }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  async function onDuplicate(p: { id: string; name: string }) {
    const copyName = prompt("Name der Kopie (wird als Entwurf angelegt, Bestand startet bei 0):", `${p.name} (Kopie)`);
    if (copyName === null || !copyName.trim()) return;
    setNotice(null);
    setBusyId(p.id);
    try {
      const res = await duplicateProduct(p.id, copyName.trim());
      invalidate();
      if (res.failedImages !== 0) {
        setNotice({ text: `„${copyName.trim()}“ angelegt, aber nicht alle Bilder konnten kopiert werden – bitte im Produkt unter „Varianten & Bilder“ prüfen.`, error: true });
      } else {
        navigate(`/admin/products/${res.id}`);
      }
    } catch (e) {
      setNotice({ text: "Duplizieren fehlgeschlagen: " + dbErrorMessage(e), error: true });
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(p: { id: string; name: string }) {
    setNotice(null);
    setBusyId(p.id);
    try {
      const ordered = await orderLineCount("product_id", p.id);
      if (ordered > 0) {
        setNotice({ text: `„${p.name}“ wurde bereits bestellt und kann nicht gelöscht werden (die Bestellungen brauchen das Produkt). Setze es stattdessen auf „Entwurf“ – dann ist es im Shop nicht mehr sichtbar.`, error: true });
        return;
      }
      if (!confirm(`Produkt „${p.name}“ mit allen Farben, Bildern, Größen, Druckzonen und Bewertungen endgültig löschen?`)) return;
      await deleteProduct(p.id);
      invalidate();
      setNotice({ text: `„${p.name}“ wurde gelöscht.` });
    } catch (e) {
      setNotice({ text: "Löschen fehlgeschlagen: " + dbErrorMessage(e), error: true });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Produkte</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv().catch((e) => setCsv({ text: "Export fehlgeschlagen: " + dbErrorMessage(e), errors: [] }))}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Download className="h-4 w-4" /> CSV-Export
          </button>
          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            title="Ändert bestehende Produkte (Zuordnung über id oder slug). Neue Produkte bitte unten anlegen."
          >
            <Upload className="h-4 w-4" /> CSV-Import
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              e.target.value = "";
              setCsv({ text: "importiere…", errors: [] });
              try {
                const res = await importCsv(file);
                setCsv({
                  text: `${res.updated} von ${res.total} Zeilen übernommen` +
                    (res.unchanged ? `, ${res.unchanged} unverändert` : "") +
                    (res.errors.length ? `, ${res.errors.length} mit Hinweis:` : "."),
                  errors: res.errors,
                });
              } catch (err) {
                setCsv({ text: "Import fehlgeschlagen: " + dbErrorMessage(err), errors: [] });
              }
              invalidate();
            }} />
          </label>
        </div>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">
        Bis zu 50 Produkte, je bis 20 Farb-Varianten. Der CSV-Import ändert nur bestehende Produkte (Zuordnung über id oder slug).
      </p>
      {csv && (
        <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm">
          <p>{csv.text}</p>
          {csv.errors.length > 0 && (
            <ul className="mt-2 max-h-60 list-disc space-y-1 overflow-y-auto pl-5 text-destructive">
              {csv.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

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
      {name.trim() && slugify(name) && <p className="-mt-4 mb-4 text-xs text-muted-foreground">Shop-Adresse: /produkt/{slugify(name)}</p>}
      {create.error && <p role="alert" className="mb-4 text-sm text-destructive">{(create.error as Error).message}</p>}
      {toggleStatus.error && <p role="alert" className="mb-4 text-sm text-destructive">{(toggleStatus.error as Error).message}</p>}
      {notice && <p role={notice.error ? "alert" : "status"} className={"mb-4 text-sm " + (notice.error ? "text-destructive" : "text-muted-foreground")}>{notice.text}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">Lade…</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data?.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <Link to={`/admin/products/${p.id}`} className="min-w-0 flex-1 hover:underline">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground no-underline">
                  {p.variants?.length ?? 0} {(p.variants?.length ?? 0) === 1 ? "Variante" : "Varianten"} · {eur(Number(p.base_price))}
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
              <Button variant="ghost" size="icon" disabled={busyId === p.id} onClick={() => onDuplicate(p)} title="Duplizieren (mit Farben, Bildern, Größen und Druckzonen)">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" disabled={busyId === p.id} onClick={() => onDelete(p)} title="Löschen">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Noch keine Produkte.</li>}
        </ul>
      )}
    </div>
  );
}
