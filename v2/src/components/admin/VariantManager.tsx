import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadVariantImage, publicUrl } from "@/lib/storage";
import { dbErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { deleteVariant, moveItem, orderLineCount, prepareProductImage, removeUnreferencedImages, saveOrder } from "./catalog";

export const VIEWS = ["front", "back", "left", "right"] as const;
const VIEW_LABEL: Record<string, string> = { front: "Vorne", back: "Hinten", left: "Links", right: "Rechts" };

async function fetchVariants(productId: string) {
  const { data, error } = await supabase
    .from("variants")
    .select("id, color_id, sort_order, colors(id, name, hex), variant_images(view, storage_path)")
    .eq("product_id", productId)
    .order("sort_order");
  if (error) throw error;
  return data;
}

async function fetchColors() {
  const { data, error } = await supabase.from("colors").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data;
}

export default function VariantManager({ productId, published = false }: { productId: string; published?: boolean }) {
  const qc = useQueryClient();
  const key = ["variants", productId];
  const { data: variants } = useQuery({ queryKey: key, queryFn: () => fetchVariants(productId) });
  const { data: colors } = useQuery({ queryKey: ["colors"], queryFn: fetchColors });
  const [colorId, setColorId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const usedColorIds = new Set(variants?.map((v) => v.color_id));
  const available = colors?.filter((c) => !usedColorIds.has(c.id)) ?? [];

  const addVariant = useMutation({
    mutationFn: async () => {
      const last = variants?.reduce((m, v) => Math.max(m, v.sort_order), 0) ?? 0;
      const { error } = await supabase
        .from("variants")
        .insert({ product_id: productId, color_id: colorId, sort_order: last + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setColorId("");
      refresh();
    },
  });

  const reorder = useMutation({
    mutationFn: (list: { id: string; sort_order: number }[]) => saveOrder("variants", list),
    onSettled: refresh,
  });

  async function removeVariant(v: { id: string; colors: { name: string } | null }) {
    setActionError(null);
    const name = v.colors?.name ?? "Variante";
    if (published && (variants?.length ?? 0) <= 1) {
      setActionError("Das ist die letzte Farbe eines veröffentlichten Produkts. Setze das Produkt zuerst auf „Entwurf“.");
      return;
    }
    try {
      const ordered = await orderLineCount("variant_id", v.id);
      if (ordered > 0) {
        setActionError(`„${name}“ wurde bereits bestellt und kann nicht gelöscht werden (alte Bestellungen brauchen die Farbe). Setze stattdessen den Bestand dieser Farbe auf 0.`);
        return;
      }
      if (!confirm(`Farbvariante „${name}“ mit allen Bildern und Bestandszahlen löschen?`)) return;
      await deleteVariant(productId, v.id);
      refresh();
      qc.invalidateQueries({ queryKey: ["matrix", productId] });
    } catch (e) {
      setActionError("Löschen fehlgeschlagen: " + dbErrorMessage(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Farbe hinzufügen</label>
          <select
            value={colorId}
            onChange={(e) => setColorId(e.target.value)}
            className="h-10 w-56 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— Farbe wählen —</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <Button disabled={!colorId || addVariant.isPending} onClick={() => addVariant.mutate()}>
          Variante anlegen
        </Button>
      </div>
      {addVariant.error && <p className="text-sm text-destructive">{dbErrorMessage(addVariant.error)}</p>}
      {reorder.error && <p role="alert" className="text-sm text-destructive">Sortieren fehlgeschlagen: {dbErrorMessage(reorder.error)}</p>}
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
      <p className="text-xs text-muted-foreground">Bilder: PNG, JPG oder WebP. Große Fotos werden beim Hochladen automatisch verkleinert (max. 2400 px, 5 MB).</p>

      <div className="space-y-3">
        {variants?.map((v: any, i: number) => (
          <div key={v.id} className="rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-5 w-5 rounded-full border" style={{ backgroundColor: v.colors?.hex }} />
              <span className="font-medium">{v.colors?.name}</span>
              <div className="ml-auto flex">
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0 || reorder.isPending} onClick={() => reorder.mutate(moveItem(variants, i, -1))} title="Nach oben (Reihenfolge im Shop)">
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === variants.length - 1 || reorder.isPending} onClick={() => reorder.mutate(moveItem(variants, i, 1))} title="Nach unten (Reihenfolge im Shop)">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeVariant(v)} title="Variante löschen">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {VIEWS.map((view) => {
                const img = v.variant_images?.find((im: any) => im.view === view);
                return (
                  <ViewUploader
                    key={view}
                    productId={productId}
                    variantId={v.id}
                    view={view}
                    storagePath={img?.storage_path}
                    frontRequired={published && view === "front"}
                    onChange={refresh}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {variants?.length === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Varianten. Farbe wählen und anlegen.</p>
        )}
      </div>
    </div>
  );
}

/** Readable text for storage / image errors. */
function uploadError(e: unknown): string {
  const msg = (e as Error)?.message ?? "";
  if (/mime|type.*not (supported|allowed)/i.test(msg)) return "Dateityp nicht erlaubt (PNG, JPG oder WebP).";
  if (/size|exceed|too large/i.test(msg)) return "Datei zu groß (max. 5 MB).";
  return msg || "Hochladen fehlgeschlagen.";
}

function ViewUploader({
  productId,
  variantId,
  view,
  storagePath,
  frontRequired,
  onChange,
}: {
  productId: string;
  variantId: string;
  view: string;
  storagePath?: string;
  frontRequired: boolean;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cache buster: changes only after an upload (re-uploads keep the same path).
  const [version, setVersion] = useState(() => Date.now());

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareProductImage(file);
      const path = await uploadVariantImage(productId, variantId, view, prepared);
      // upsert the variant_images row for (variant, view)
      const { error } = await supabase
        .from("variant_images")
        .upsert(
          { variant_id: variantId, view, storage_path: path },
          { onConflict: "variant_id,view" }
        );
      if (error) throw error;
      // A different file type means a different path: drop the old file.
      if (storagePath && storagePath !== path) await removeUnreferencedImages([storagePath]);
      setVersion(Date.now());
      onChange();
    } catch (e) {
      setError(uploadError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!storagePath) return;
    if (frontRequired) {
      setError("Vorderansicht ist bei veröffentlichten Produkten Pflicht – einfach ein neues Bild hochladen.");
      return;
    }
    if (!confirm(`Bild „${VIEW_LABEL[view]}“ entfernen?`)) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("variant_images").delete().match({ variant_id: variantId, view });
    if (error) setError(dbErrorMessage(error));
    else await removeUnreferencedImages([storagePath]);
    setBusy(false);
    onChange();
  }

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title={storagePath ? "Bild ersetzen" : "Bild hochladen"}
          className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/30 hover:bg-muted"
        >
          {storagePath ? (
            <img loading="lazy" decoding="async" src={publicUrl(storagePath) + `?v=${version}`} alt={view} className="h-full w-full object-cover" />
          ) : (
            !busy && <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          {busy && <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs text-muted-foreground">Lädt…</span>}
        </button>
        {storagePath && !busy && (
          <button
            type="button"
            onClick={onRemove}
            title="Bild entfernen"
            aria-label={`Bild ${VIEW_LABEL[view]} entfernen`}
            className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 text-muted-foreground shadow hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">{VIEW_LABEL[view]}</p>
      {error && <p className="text-center text-[10px] text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
