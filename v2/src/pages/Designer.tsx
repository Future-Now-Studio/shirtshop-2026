import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as fabric from "fabric";
import { Type, ImagePlus, Trash2, ShoppingCart, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { publicUrl } from "@/lib/storage";
import { uploadDesignFile, uploadDesignJson } from "@/lib/design-upload";
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
  const [sizeQty, setSizeQty] = useState<Record<string, number>>({}); // size_id -> quantity
  const [elementCount, setElementCount] = useState(0);
  const [imgLoading, setImgLoading] = useState(false);
  const [step, setStep] = useState(1);
  const imgCache = useRef<Map<string, fabric.FabricImage>>(new Map());

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
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });
    canvasRef.current = c;
    const onChange = () => recountRef.current();
    c.on("object:added", onChange);
    c.on("object:removed", onChange);
    loadView(view, variant);
    return () => {
      c.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Render a view of a specific variant: background image + zone guides + saved objects.
  // A monotonic token ensures only the latest load wins (variant/view can change fast).
  const loadTokenRef = useRef(0);
  const loadView = useCallback(
    async (targetView: string, targetVariant: any) => {
      const c = canvasRef.current;
      if (!c) return;
      const token = ++loadTokenRef.current;
      c.remove(...c.getObjects());
      c.backgroundImage = undefined;

      // background image for this variant+view (fall back to front, then any view)
      const img =
        targetVariant?.variant_images?.find((i: any) => i.view === targetView) ||
        targetVariant?.variant_images?.find((i: any) => i.view === "front") ||
        targetVariant?.variant_images?.[0];
      if (img) {
        const url = publicUrl(img.storage_path);
        try {
          let base = imgCache.current.get(url);
          if (!base) {
            setImgLoading(true);
            base = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
            imgCache.current.set(url, base);
          }
          if (token !== loadTokenRef.current) return; // a newer load started — discard
          const fImg = await base.clone();
          const scale = Math.min(SIZE / (fImg.width || SIZE), SIZE / (fImg.height || SIZE));
          fImg.scale(scale);
          fImg.set({ left: (SIZE - (fImg.width || 0) * scale) / 2, top: (SIZE - (fImg.height || 0) * scale) / 2 });
          c.backgroundImage = fImg;
        } catch {
          c.backgroundImage = undefined;
        }
      }
      if (token !== loadTokenRef.current) return;
      setImgLoading(false);

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
        if (token !== loadTokenRef.current) return;
        objs.forEach((o: any) => c.add(o));
      }
      c.renderAll();
      recount();
    },
    [p, recount]
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
    loadView(view, variant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, variant?.id, p]);

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

  const totalPieces = Object.values(sizeQty).reduce((s, q) => s + (q || 0), 0);

  async function handleAddToCart() {
    if (!p) return;
    const entries = Object.entries(sizeQty).filter(([, q]) => q > 0);
    if (entries.length === 0) return;
    saveView(view);

    const c = canvasRef.current!;
    const originalView = view;
    const designId = (crypto as any).randomUUID();
    const manifest: any[] = [];
    let thumbnail: string | undefined;
    let anyDesign = false;

    // For every view that has design objects: upload composite, design-only and each element.
    for (const v of VIEWS) {
      const objs = (viewJson.current[v]?.objects ?? []).filter((o: any) => !o.__zone);
      if (objs.length === 0) continue;
      anyDesign = true;
      await loadView(v, variant);

      // composite (garment + design)
      try {
        const composite = c.toDataURL({ format: "png", multiplier: 1.5 });
        await uploadDesignFile(designId, `${v}-composite.png`, composite);
        if (!thumbnail) thumbnail = c.toDataURL({ format: "png", multiplier: 0.28 }); // tiny cart preview
      } catch { /* skip */ }

      // design-only (objects on transparent, no garment)
      const bg = c.backgroundImage;
      c.backgroundImage = undefined;
      c.renderAll();
      try {
        const designOnly = c.toDataURL({ format: "png", multiplier: 2 });
        await uploadDesignFile(designId, `${v}-design.png`, designOnly);
      } catch { /* skip */ }

      // each element separately
      const live = c.getObjects().filter((o: any) => !o.__zone);
      for (let i = 0; i < live.length; i++) {
        const o: any = live[i];
        try {
          const png = o.toDataURL({ format: "png", multiplier: 2 });
          await uploadDesignFile(designId, `${v}-element-${i + 1}.png`, png);
        } catch { /* skip */ }
        manifest.push({
          view: v,
          index: i + 1,
          type: o.type,
          text: o.type === "textbox" || o.type === "i-text" ? o.text : undefined,
          fontFamily: o.fontFamily,
          fill: o.fill,
          left: Math.round(o.left),
          top: Math.round(o.top),
          width: Math.round(o.getScaledWidth?.() ?? o.width),
          height: Math.round(o.getScaledHeight?.() ?? o.height),
          angle: Math.round(o.angle ?? 0),
        });
      }
      c.backgroundImage = bg;
      c.renderAll();
    }

    if (anyDesign) {
      await uploadDesignJson(designId, viewJson.current);
    }

    // one cart line per chosen size; heavy media lives in storage, cart keeps only ids
    for (const [sid, q] of entries) {
      addToCart({
        productId: p.id,
        productName: p.name,
        slug: p.slug,
        variantId: variant.id,
        colorName: variant.colors?.name,
        sizeId: sid,
        sizeName: sizes.find((s: any) => s.id === sid)?.name ?? null,
        qty: q,
        basePrice: Number(p.base_price),
        designElementPrice: Number(p.design_element_price),
        designElementCount: elementCount,
        designId: anyDesign ? designId : undefined,
        designManifest: anyDesign ? manifest : undefined,
        thumbnail,
      });
    }
    await loadView(originalView, variant);
    navigate("/warenkorb");
  }

  const availForSize = (sid: string) =>
    variant?.variant_size_availability?.find((a: any) => a.size_id === sid && a.available && a.stock > 0);
  const unit = p ? Number(p.base_price) + elementCount * Number(p.design_element_price) : 0;
  const fileRef = useRef<HTMLInputElement>(null);

  if (!p) return <p className="text-muted-foreground">Lade…</p>;

  return (
    <div>
      <div className="mb-6">
        <Link to={`/produkt/${p.slug}`} className="text-sm text-muted-foreground hover:text-primary">← zurück zum produkt</Link>
        <h1 className="mt-2 text-3xl font-black lowercase sm:text-4xl">
          <span className="text-primary">creator</span>
          <span className="text-muted-foreground"> · {p.name}</span>
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Tool rail */}
        <div className="lg:col-span-2">
          <div className="flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm">
            <Button variant="ghost" className="h-11 w-full justify-start gap-2.5 rounded-xl font-medium" onClick={addText}>
              <Type className="h-4 w-4 shrink-0" /> Text
            </Button>
            <Button variant="ghost" className="h-11 w-full justify-start gap-2.5 rounded-xl font-medium" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4 shrink-0" /> Bild
            </Button>
            <Button
              variant="ghost"
              className="h-11 w-full justify-start gap-2.5 rounded-xl font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={deleteSelected}
            >
              <Trash2 className="h-4 w-4 shrink-0" /> Löschen
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

        {/* Canvas + views */}
        <div className="lg:col-span-6">
          <div className="flex items-center justify-center rounded-2xl bg-muted/30 p-4 sm:p-6">
            <div className="relative overflow-hidden rounded-xl bg-white shadow-sm">
              <canvas ref={canvasElRef} width={SIZE} height={SIZE} />
              {imgLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border bg-card p-3 shadow-sm">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ansichten</p>
            <div className="flex flex-wrap gap-2">
              {VIEWS.map((v) => {
                const img =
                  variant?.variant_images?.find((i: any) => i.view === v) ||
                  variant?.variant_images?.find((i: any) => i.view === "front") ||
                  variant?.variant_images?.[0];
                const active = view === v;
                return (
                  <button
                    key={v}
                    onClick={() => switchView(v)}
                    className={
                      "relative h-20 w-20 overflow-hidden rounded-lg border-2 " +
                      (active ? "border-primary" : "border-transparent hover:border-border")
                    }
                  >
                    {img ? (
                      <img src={publicUrl(img.storage_path)} alt={VIEW_LABEL[v]} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">kein bild</span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[10px] font-medium text-white">
                      {VIEW_LABEL[v]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Config — step based */}
        <div className="lg:col-span-4">
          <div className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-bold">{p.name}</h2>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{unit.toFixed(2)} €</p>
              <p className="text-xs text-muted-foreground">
                Basis {Number(p.base_price).toFixed(2)} € + {elementCount} Element(e) × {Number(p.design_element_price).toFixed(2)} €
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className={"flex h-6 w-6 items-center justify-center rounded-full " + (step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>1</span>
              <span className={step === 1 ? "text-foreground" : "text-muted-foreground"}>design & farbe</span>
              <span className="mx-1 h-px flex-1 bg-border" />
              <span className={"flex h-6 w-6 items-center justify-center rounded-full " + (step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>2</span>
              <span className={step === 2 ? "text-foreground" : "text-muted-foreground"}>größe & menge</span>
            </div>

            {step === 1 ? (
              <>
                <div>
                  <p className="mb-2 text-sm font-medium">Farbe: {variant?.colors?.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v: any, i: number) => (
                      <button
                        key={v.id}
                        onClick={() => { saveView(view); setVariantIdx(i); setSizeQty({}); }}
                        title={v.colors?.name}
                        className={"h-8 w-8 rounded-full border-2 " + (i === variantIdx ? "border-primary ring-2 ring-primary/30" : "border-border")}
                        style={{ backgroundColor: v.colors?.hex }}
                      />
                    ))}
                  </div>
                </div>
                <Button className="w-full" size="lg" onClick={() => setStep(2)}>
                  weiter zu größe & menge <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                  <ArrowLeft className="h-4 w-4" /> zurück zu design & farbe
                </button>
                <div>
                  <p className="mb-3 text-sm font-medium">Menge je Größe</p>
                  <div className="divide-y rounded-xl border">
                    {sizes.map((s: any) => {
                      const ok = availForSize(s.id);
                      const q = sizeQty[s.id] ?? 0;
                      const setQ = (n: number) =>
                        setSizeQty((m) => ({ ...m, [s.id]: Math.max(0, Math.min(ok?.stock ?? 999, n)) }));
                      return (
                        <div key={s.id} className={"flex items-center justify-between gap-3 px-3 py-2.5 " + (!ok ? "opacity-40" : "")}>
                          <span className="text-sm font-medium">
                            {s.name}
                            {!ok && <span className="ml-2 text-xs text-muted-foreground">ausverkauft</span>}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={!ok || q <= 0}
                              onClick={() => setQ(q - 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent disabled:opacity-30"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              disabled={!ok}
                              value={q}
                              onChange={(e) => setQ(Number(e.target.value))}
                              className="h-8 w-12 rounded-md border border-input bg-background text-center text-sm"
                            />
                            <button
                              disabled={!ok}
                              onClick={() => setQ(q + 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent disabled:opacity-30"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{totalPieces} Stück gesamt</span>
                  <span className="font-bold tabular-nums">{(unit * totalPieces).toFixed(2)} €</span>
                </div>
                <Button className="w-full" size="lg" disabled={totalPieces === 0} onClick={handleAddToCart}>
                  <ShoppingCart className="mr-2 h-4 w-4" /> In den Warenkorb
                </Button>
                {totalPieces === 0 && <p className="text-center text-xs text-muted-foreground">Mindestens 1 Stück wählen.</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
