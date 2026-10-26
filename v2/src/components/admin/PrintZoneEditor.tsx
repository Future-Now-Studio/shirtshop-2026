import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { publicUrl } from "@/lib/storage";
import { dbErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VIEWS } from "./VariantManager";

const VIEW_LABEL: Record<string, string> = { front: "Vorne", back: "Hinten", left: "Links", right: "Rechts" };
const MIN = 0.02; // smallest zone edge (2 % of the image)
const STEP = 0.01; // arrow-key step

type Rect = { x: number; y: number; w: number; h: number };
type Drag = { mode: "draw" | "move" | "resize"; id?: string; start: { x: number; y: number }; orig?: Rect };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number) => Math.round(n * 10000) / 10000;

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
  // Live rectangle while drawing (no id) or moving/resizing a zone (with id).
  const [draft, setDraft] = useState<null | (Rect & { id?: string })>(null);
  const dragRef = useRef<Drag | null>(null);

  const addZone = useMutation({
    mutationFn: async (rect: Rect) => {
      const { error } = await supabase.from("print_zones").insert({
        product_id: productId,
        view,
        x: round(rect.x),
        y: round(rect.y),
        width: round(rect.w),
        height: round(rect.h),
        label: `Zone ${(data?.zones.length ?? 0) + 1}`,
        sort_order: (data?.zones.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const moveZone = useMutation({
    mutationFn: async (p: { id: string } & Rect) => {
      const { error } = await supabase
        .from("print_zones")
        .update({ x: round(p.x), y: round(p.y), width: round(p.w), height: round(p.h) })
        .eq("id", p.id);
      if (error) throw error;
    },
    // Show the new position right away; the refetch corrects it on failure.
    onMutate: (p) =>
      qc.setQueryData(key, (old: Awaited<ReturnType<typeof fetchZoneData>> | undefined) =>
        old && {
          ...old,
          zones: old.zones.map((z) => (z.id === p.id ? { ...z, x: round(p.x), y: round(p.y), width: round(p.w), height: round(p.h) } : z)),
        }
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
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

  /** Pointer position relative to the image (0..1), clamped to the image. */
  function rel(e: React.PointerEvent) {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  }

  function startDrag(e: React.PointerEvent, drag: Omit<Drag, "start">) {
    if (!data?.imagePath || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    boxRef.current!.setPointerCapture(e.pointerId);
    const start = rel(e);
    dragRef.current = { ...drag, start };
    setDraft(drag.orig ? { ...drag.orig, id: drag.id } : { ...start, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const p = rel(e);
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (d.mode === "draw") {
      setDraft({ x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(dx), h: Math.abs(dy) });
    } else if (d.mode === "move" && d.orig) {
      setDraft({ ...d.orig, id: d.id, x: clamp(d.orig.x + dx, 0, 1 - d.orig.w), y: clamp(d.orig.y + dy, 0, 1 - d.orig.h) });
    } else if (d.mode === "resize" && d.orig) {
      setDraft({ ...d.orig, id: d.id, w: clamp(d.orig.w + dx, MIN, 1 - d.orig.x), h: clamp(d.orig.h + dy, MIN, 1 - d.orig.y) });
    }
  }

  function endDrag() {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && draft) {
      if (d.mode === "draw" && draft.w > MIN && draft.h > MIN) addZone.mutate(draft);
      const o = d.orig;
      if (d.id && o && (draft.x !== o.x || draft.y !== o.y || draft.w !== o.w || draft.h !== o.h)) {
        moveZone.mutate({ id: d.id, x: draft.x, y: draft.y, w: draft.w, h: draft.h });
      }
    }
    setDraft(null);
  }

  /** Arrow keys move a focused zone by 1 %; with Shift they resize it. */
  function onZoneKey(e: React.KeyboardEvent, z: Rect & { id: string }) {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir) return;
    e.preventDefault();
    const [kx, ky] = dir;
    const next = e.shiftKey
      ? { ...z, w: clamp(z.w + kx * STEP, MIN, 1 - z.x), h: clamp(z.h + ky * STEP, MIN, 1 - z.y) }
      : { ...z, x: clamp(z.x + kx * STEP, 0, 1 - z.w), y: clamp(z.y + ky * STEP, 0, 1 - z.h) };
    moveZone.mutate(next);
  }

  const failed = addZone.error ?? moveZone.error ?? removeZone.error ?? renameZone.error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => { setView(v); setDraft(null); }}
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
        Rechteck auf dem Bild ziehen, um eine Druckzone anzulegen (Maus, Finger oder Stift). Zone verschieben: in die Zone
        tippen und ziehen; Größe ändern: am Eck unten rechts ziehen. Mit der Tastatur: Zone anwählen, Pfeiltasten
        verschieben, Umschalt + Pfeiltasten ändern die Größe. Zonen gelten für alle Farben.
      </p>
      {failed && <p role="alert" className="text-sm text-destructive">Speichern fehlgeschlagen: {dbErrorMessage(failed)}</p>}

      <div className="flex flex-col gap-6 sm:flex-row">
        <div
          ref={boxRef}
          className="relative aspect-square w-full max-w-[360px] touch-none select-none overflow-hidden rounded-lg border bg-muted/30"
          onPointerDown={(e) => startDrag(e, { mode: "draw" })}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={() => { dragRef.current = null; setDraft(null); }}
        >
          {data?.imagePath ? (
            <img loading="lazy" decoding="async" src={publicUrl(data.imagePath)} alt={view} className="pointer-events-none h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Kein Bild für diese Ansicht. Erst Varianten-Bild hochladen.
            </div>
          )}
          {data?.zones.map((z) => {
            const live = draft?.id === z.id ? draft : null;
            const r = live ?? { x: Number(z.x), y: Number(z.y), w: Number(z.width), h: Number(z.height) };
            const orig = { x: Number(z.x), y: Number(z.y), w: Number(z.width), h: Number(z.height) };
            return (
              <div
                key={z.id}
                role="button"
                tabIndex={0}
                aria-label={`Druckzone ${z.label ?? ""} – Pfeiltasten verschieben, Umschalt + Pfeiltasten Größe`}
                className="absolute cursor-move border-2 border-primary bg-primary/10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                onPointerDown={(e) => startDrag(e, { mode: "move", id: z.id, orig })}
                onKeyDown={(e) => onZoneKey(e, { id: z.id, ...orig })}
              >
                <span className="pointer-events-none absolute left-0 top-0 bg-primary px-1 text-[10px] text-primary-foreground">{z.label}</span>
                <span
                  aria-hidden
                  title="Größe ändern"
                  className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-primary bg-background"
                  onPointerDown={(e) => startDrag(e, { mode: "resize", id: z.id, orig })}
                />
              </div>
            );
          })}
          {draft && !draft.id && (
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
                aria-label="Name der Zone"
                onBlur={(e) => e.target.value !== z.label && renameZone.mutate({ id: z.id, label: e.target.value })}
                className="h-8 flex-1 rounded border border-input bg-background px-2 text-sm"
              />
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(z.width * 100)}×{Math.round(z.height * 100)}%
              </span>
              <Button variant="ghost" size="icon" title="Zone löschen" onClick={() => confirm(`Druckzone „${z.label ?? ""}“ löschen?`) && removeZone.mutate(z.id)}>
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
