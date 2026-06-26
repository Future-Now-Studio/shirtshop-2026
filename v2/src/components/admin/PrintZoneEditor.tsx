import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { publicUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { VIEWS } from "./VariantManager";

const VIEW_LABEL: Record<string, string> = { front: "Vorne", back: "Hinten", left: "Links", right: "Rechts" };

async function fetchZoneData(productId: string, view: string) {
  const [zones, image] = await Promise.all([
    supabase.from("print_zones").select("*").eq("product_id", productId).eq("view", view).order("sort_order"),
    supabase
      .from("variant_images")
      .select("storage_path, variants!inner(product_id, sort_order)")
      .eq("view", view)
      .eq("variants.product_id", productId)
      .order("sort_order", { foreignTable: "variants" })
      .limit(1),
  ]);
  if (zones.error) throw zones.error;
  if (image.error) throw image.error;
  return { zones: zones.data, imagePath: image.data?.[0]?.storage_path as string | undefined };
}

export default function PrintZoneEditor({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const [view, setView] = useState<string>("front");
  const key = ["zones", productId, view];
  const { data } = useQuery({ queryKey: key, queryFn: () => fetchZoneData(productId, view) });

  const boxRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const addZone = useMutation({
    mutationFn: async (rect: { x: number; y: number; w: number; h: number }) => {
      const { error } = await supabase.from("print_zones").insert({
        product_id: productId,
        view,
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
        label: `Zone ${(data?.zones.length ?? 0) + 1}`,
        sort_order: (data?.zones.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const removeZone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("print_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const renameZone = useMutation({
    mutationFn: async (p: { id: string; label: string }) => {
      const { error } = await supabase.from("print_zones").update({ label: p.label }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  function rel(e: React.MouseEvent) {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={
              "rounded-md border px-3 py-1.5 text-sm " +
              (view === v ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")
            }
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Rechteck auf dem Bild ziehen, um eine Druckzone anzulegen. Zonen gelten für alle Farben.
      </p>

      <div className="flex gap-6">
        <div
          ref={boxRef}
          className="relative aspect-square w-[360px] select-none overflow-hidden rounded-lg border bg-muted/30"
          onMouseDown={(e) => {
            if (!data?.imagePath) return;
            startRef.current = rel(e);
            setDraft({ ...startRef.current, w: 0, h: 0 });
          }}
          onMouseMove={(e) => {
            if (!startRef.current) return;
            const p = rel(e);
            const s = startRef.current;
            setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
          }}
          onMouseUp={() => {
            if (draft && draft.w > 0.02 && draft.h > 0.02) addZone.mutate(draft);
            startRef.current = null;
            setDraft(null);
          }}
        >
          {data?.imagePath ? (
            <img src={publicUrl(data.imagePath)} alt={view} className="pointer-events-none h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Kein Bild für diese Ansicht. Erst Varianten-Bild hochladen.
            </div>
          )}
          {data?.zones.map((z) => (
            <div
              key={z.id}
              className="absolute border-2 border-primary bg-primary/10"
              style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.width * 100}%`, height: `${z.height * 100}%` }}
            >
              <span className="absolute left-0 top-0 bg-primary px-1 text-[10px] text-primary-foreground">{z.label}</span>
            </div>
          ))}
          {draft && (
            <div
              className="absolute border-2 border-dashed border-primary bg-primary/20"
              style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }}
            />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium">Zonen ({VIEW_LABEL[view]})</p>
          {data?.zones.map((z) => (
            <div key={z.id} className="flex items-center gap-2">
              <input
                defaultValue={z.label ?? ""}
                onBlur={(e) => e.target.value !== z.label && renameZone.mutate({ id: z.id, label: e.target.value })}
                className="h-8 flex-1 rounded border border-input bg-background px-2 text-sm"
              />
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(z.width * 100)}×{Math.round(z.height * 100)}%
              </span>
              <Button variant="ghost" size="icon" onClick={() => removeZone.mutate(z.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {data?.zones.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Zonen.</p>}
        </div>
      </div>
    </div>
  );
}
