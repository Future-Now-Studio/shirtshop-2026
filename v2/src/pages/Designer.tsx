import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as fabric from "fabric";
import { Type, ImagePlus, Trash2, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { publicUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { useCart } from "@/stores/cart";

const VIEWS = ["front", "back", "left", "right"] as const;
const VIEW_LABEL: Record<string, string> = { front: "Vorne", back: "Hinten", left: "Links", right: "Rechts" };
const SIZE = 480;

async function fetchProduct(slug: string) {
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, slug, name, base_price, design_element_price,
       variants(id, sort_order, colors(id, name, hex), variant_images(view, storage_path),
                variant_size_availability(size_id, available, stock)),
       print_zones(id, view, x, y, width, height, label),
       product_sizes(sizes(id, name, sort_order))`
    )
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  if (error) throw error;
  return data;
}

export default function Designer() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: p } = useQuery({ queryKey: ["designer", slug], queryFn: () => fetchProduct(slug!) });
  const addToCart = useCart((s) => s.add);

  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const viewJson = useRef<Record<string, any>>({});

  const [variantIdx, setVariantIdx] = useState(0);
  const [view, setView] = useState<string>("front");
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [elementCount, setElementCount] = useState(0);

  const variants = (p?.variants ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);
  const variant: any = variants[variantIdx];
  const sizes = (p?.product_sizes ?? []).map((ps: any) => ps.sizes).sort((a: any, b: any) => a.sort_order - b.sort_order);

  // Count design objects across all views (exclude zone guides + background)
  const recount = useCallback(() => {
    let n = 0;
    for (const v of VIEWS) {
      if (v === view) {
        n += canvasRef.current?.getObjects().filter((o: any) => !o.__zone).length ?? 0;
      } else {
        n += (viewJson.current[v]?.objects?.filter((o: any) => !o.__zone).length) ?? 0;
      }
    }
    setElementCount(n);
  }, [view]);

  // Keep a stable ref to the latest recount so canvas listeners never go stale.
  const recountRef = useRef(recount);
  recountRef.current = recount;

  // Init canvas once the product (and therefore the canvas element) is present.
  const ready = !!p;
  useEffect(() => {
    if (!ready || !canvasElRef.current || canvasRef.current) return;
    const c = new fabric.Canvas(canvasElRef.current, {
      width: SIZE,
      height: SIZE,
      backgroundColor: "#f4f4f5",
      preserveObjectStacking: true,
    });
    canvasRef.current = c;
    const onChange = () => recountRef.current();
    c.on("object:added", onChange);
    c.on("object:removed", onChange);
    loadView(view);
    return () => {
      c.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Render the current view: background image + zone guides + saved objects
  const loadView = useCallback(
    async (targetView: string) => {
      const c = canvasRef.current;
      if (!c) return;
      c.remove(...c.getObjects());

      // background image for this variant+view
      const img = variant?.variant_images?.find((i: any) => i.view === targetView);
      if (img) {
        try {
          const fImg = await fabric.FabricImage.fromURL(publicUrl(img.storage_path), { crossOrigin: "anonymous" });
          const scale = Math.min(SIZE / (fImg.width || SIZE), SIZE / (fImg.height || SIZE));
          fImg.scale(scale);
          fImg.set({ left: (SIZE - (fImg.width || 0) * scale) / 2, top: (SIZE - (fImg.height || 0) * scale) / 2 });
          c.backgroundImage = fImg;
        } catch {
          c.backgroundImage = undefined;
        }
      } else {
        c.backgroundImage = undefined;
      }

      // zone guides
      const zones = (p?.print_zones ?? []).filter((z: any) => z.view === targetView);
      for (const z of zones) {
        const rect = new fabric.Rect({
          left: z.x * SIZE,
          top: z.y * SIZE,
          width: z.width * SIZE,
          height: z.height * SIZE,
          fill: "rgba(0,0,0,0)",
          stroke: "#6366f1",
          strokeDashArray: [6, 4],
          strokeWidth: 1.5,
          selectable: false,
          evented: false,
        });
        (rect as any).__zone = true;
        c.add(rect);
      }

      // saved design objects for this view
      if (viewJson.current[targetView]?.objects?.length) {
        const saved = viewJson.current[targetView];
        const designOnly = { ...saved, objects: saved.objects.filter((o: any) => !o.__zone) };
        const objs = await fabric.util.enlivenObjects(designOnly.objects);
        objs.forEach((o: any) => c.add(o));
      }
      c.renderAll();
      recount();
    },
    [p, variant, recount]
  );

  // Save current view's objects to memory
  const saveView = useCallback((v: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const json = c.toJSON();
    json.objects = (json.objects || []).filter((o: any) => !o.__zone);
    viewJson.current[v] = json;
  }, []);

  // When variant or view changes, swap canvas content
  useEffect(() => {
    loadView(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, variantIdx, p]);

  function switchView(v: string) {
    if (v === view) return;
    saveView(view);
    setView(v);
  }

  function addText() {
    const c = canvasRef.current;
    if (!c) return;
    const t = new fabric.Textbox("Dein Text", {
      left: SIZE / 2 - 60,
      top: SIZE / 2 - 15,
      fontSize: 28,
      fill: "#111111",
      width: 160,
      textAlign: "center",
    });
    c.add(t);
    c.setActiveObject(t);
    c.renderAll();
  }

  function addImage(file: File) {
    const c = canvasRef.current;
    if (!c) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const img = await fabric.FabricImage.fromURL(reader.result as string);
      const scale = Math.min((SIZE * 0.5) / (img.width || 1), (SIZE * 0.5) / (img.height || 1));
      img.scale(scale);
      img.set({ left: SIZE / 2 - (img.width! * scale) / 2, top: SIZE / 2 - (img.height! * scale) / 2 });
      c.add(img);
      c.setActiveObject(img);
      c.renderAll();
    };
    reader.readAsDataURL(file);
  }

  function deleteSelected() {
    const c = canvasRef.current;
    const obj = c?.getActiveObject();
    if (c && obj && !(obj as any).__zone) {
      c.remove(obj);
      c.renderAll();
    }
  }

  async function handleAddToCart() {
    if (!p || !sizeId) return;
    saveView(view);

    // Render each view that has design objects to a PNG
    const c = canvasRef.current!;
    const renders: Record<string, string> = {};
    const originalView = view;
    for (const v of VIEWS) {
      const hasObjects = (viewJson.current[v]?.objects?.length ?? 0) > 0;
      if (!hasObjects) continue;
      await loadView(v);
      try {
        renders[v] = c.toDataURL({ format: "png", multiplier: 1 });
      } catch {
        /* tainted canvas — skip render */
      }
    }
    await loadView(originalView);

    addToCart({
      productId: p.id,
      productName: p.name,
      slug: p.slug,
      variantId: variant.id,
      colorName: variant.colors?.name,
      sizeId,
      sizeName: sizes.find((s: any) => s.id === sizeId)?.name ?? null,
      qty,
      basePrice: Number(p.base_price),
      designElementPrice: Number(p.design_element_price),
      designElementCount: elementCount,
      designRenders: renders,
      designData: JSON.stringify(viewJson.current),
      thumbnail: renders[originalView] ?? renders[Object.keys(renders)[0]],
    });
    navigate("/warenkorb");
  }

  const availForSize = (sid: string) =>
    variant?.variant_size_availability?.find((a: any) => a.size_id === sid && a.available && a.stock > 0);
  const unit = p ? Number(p.base_price) + elementCount * Number(p.design_element_price) : 0;
  const fileRef = useRef<HTMLInputElement>(null);

  if (!p) return <p className="text-muted-foreground">Lade…</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-[480px_1fr]">
      <div>
        <div className="mb-3 flex gap-2">
          {VIEWS.map((v) => {
            const has = variant?.variant_images?.some((i: any) => i.view === v);
            return (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={
                  "rounded-md border px-3 py-1.5 text-xs " +
                  (view === v ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground") +
                  (!has ? " opacity-60" : "")
                }
              >
                {VIEW_LABEL[v]}
              </button>
            );
          })}
        </div>
        <div className="inline-block overflow-hidden rounded-2xl border bg-card shadow-card">
          <canvas ref={canvasElRef} width={SIZE} height={SIZE} />
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={addText}>
            <Type className="mr-1 h-4 w-4" /> Text
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="mr-1 h-4 w-4" /> Bild
          </Button>
          <Button variant="outline" size="sm" onClick={deleteSelected}>
            <Trash2 className="mr-1 h-4 w-4" /> Löschen
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addImage(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div>
        <Link to={`/produkt/${p.slug}`} className="text-sm text-muted-foreground hover:text-foreground">← Zurück zum Produkt</Link>
        <h1 className="mt-2 text-2xl font-bold">{p.name} gestalten</h1>
        <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{unit.toFixed(2)} €</p>
        <p className="text-xs text-muted-foreground">
          Basis {Number(p.base_price).toFixed(2)} € + {elementCount} Design-Element(e) × {Number(p.design_element_price).toFixed(2)} €
        </p>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Farbe: {variant?.colors?.name}</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v: any, i: number) => (
              <button
                key={v.id}
                onClick={() => {
                  saveView(view);
                  setVariantIdx(i);
                  setSizeId(null);
                }}
                title={v.colors?.name}
                className={"h-8 w-8 rounded-full border-2 " + (i === variantIdx ? "border-primary" : "border-transparent")}
                style={{ backgroundColor: v.colors?.hex }}
              />
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium">Größe</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s: any) => {
              const ok = availForSize(s.id);
              return (
                <button
                  key={s.id}
                  disabled={!ok}
                  onClick={() => setSizeId(s.id)}
                  className={
                    "min-w-[3rem] rounded-md border px-3 py-2 text-sm " +
                    (sizeId === s.id ? "border-primary bg-primary text-primary-foreground" : "") +
                    (!ok ? " cursor-not-allowed text-muted-foreground line-through opacity-40" : "")
                  }
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium">Menge</p>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            className="h-10 w-24 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <Button className="mt-8 px-8" disabled={!sizeId} onClick={handleAddToCart}>
          <ShoppingCart className="mr-2 h-4 w-4" /> In den Warenkorb
        </Button>
        {!sizeId && <p className="mt-2 text-xs text-muted-foreground">Bitte Größe wählen.</p>}
      </div>
    </div>
  );
}
