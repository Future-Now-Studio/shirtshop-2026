import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadVariantImage, publicUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";

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

export default function VariantManager({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const key = ["variants", productId];
  const { data: variants } = useQuery({ queryKey: key, queryFn: () => fetchVariants(productId) });
  const { data: colors } = useQuery({ queryKey: ["colors"], queryFn: fetchColors });
  const [colorId, setColorId] = useState("");

  const usedColorIds = new Set(variants?.map((v) => v.color_id));
  const available = colors?.filter((c) => !usedColorIds.has(c.id)) ?? [];

  const addVariant = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("variants")
        .insert({ product_id: productId, color_id: colorId, sort_order: (variants?.length ?? 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      setColorId("");
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const removeVariant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

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
      {addVariant.error && <p className="text-sm text-destructive">{(addVariant.error as Error).message}</p>}

      <div className="space-y-3">
        {variants?.map((v: any) => (
          <div key={v.id} className="rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-5 w-5 rounded-full border" style={{ backgroundColor: v.colors?.hex }} />
              <span className="font-medium">{v.colors?.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() => removeVariant.mutate(v.id)}
                title="Variante löschen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {VIEWS.map((view) => {
                const img = v.variant_images?.find((i: any) => i.view === view);
                return (
                  <ViewUploader
                    key={view}
                    productId={productId}
                    variantId={v.id}
                    view={view}
                    storagePath={img?.storage_path}
                    onChange={() => qc.invalidateQueries({ queryKey: key })}
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

function ViewUploader({
  productId,
  variantId,
  view,
  storagePath,
  onChange,
}: {
  productId: string;
  variantId: string;
  view: string;
  storagePath?: string;
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const path = await uploadVariantImage(productId, variantId, view, file);
      // upsert the variant_images row for (variant, view)
      const { error } = await supabase
        .from("variant_images")
        .upsert(
          { variant_id: variantId, view, storage_path: path },
          { onConflict: "variant_id,view" }
        );
      if (error) throw error;
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/30 hover:bg-muted"
      >
        {storagePath ? (
          <img src={publicUrl(storagePath) + `?t=${Date.now()}`} alt={view} className="h-full w-full object-cover" />
        ) : busy ? (
          <span className="text-xs text-muted-foreground">Lädt…</span>
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      <p className="mt-1 text-center text-xs text-muted-foreground">{VIEW_LABEL[view]}</p>
      {error && <p className="text-center text-[10px] text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
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
