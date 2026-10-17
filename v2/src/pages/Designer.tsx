import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as fabric from "fabric";
import { Type, ImagePlus, Trash2, ShoppingCart, Loader2, ArrowRight, ArrowLeft, AlertTriangle, Download, Bold, Minus, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { publicUrl } from "@/lib/storage";
import { uploadDesignFile, uploadDesignJson } from "@/lib/design-upload";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/NotFound";
import { setPageMeta } from "@/lib/seo";
import { useCart } from "@/stores/cart";
import { PRICE_NOTE } from "@/lib/pricing";
import { eur } from "@/lib/utils";

const VIEWS = ["front", "back", "left", "right"] as const;
const VIEW_LABEL: Record<string, string> = { front: "Vorne", back: "Hinten", left: "Links", right: "Rechts" };
const SIZE = 480;

const TEXT_COLORS = ["#111111", "#ffffff", "#e6007e", "#f5b700", "#d32f2f", "#1565c0", "#2e7d32", "#7f8c8d"];
const FONTS = ["Outfit", "Arial", "Georgia", "Courier New", "Impact", "Brush Script MT"];

/** Readable default text colour for a garment colour (white on dark shirts). */
function contrastText(hex?: string | null) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return "#111111";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.5 ? "#ffffff" : "#111111";
}

async function fetchProduct(slug: string) {
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, slug, name, base_price, design_element_price,
       variants(id, hex, sort_order, colors(id, name, hex), variant_images(view, storage_path),
                variant_size_availability(size_id, available, stock)),
       print_zones(id, view, x, y, width, height, label),
       product_sizes(sizes(id, name, sort_order))`
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export default function Designer() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: p, isLoading: productLoading, error: productError } = useQuery({ queryKey: ["designer", slug], queryFn: () => fetchProduct(slug!) });
  const addToCart = useCart((s) => s.add);

  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const viewJson = useRef<Record<string, any>>({});

  const [variantIdx, setVariantIdx] = useState(0);
  const [view, setView] = useState<string>("front");
  const [sizeQty, setSizeQty] = useState<Record<string, number>>({}); // size_id -> quantity
  const [elementCount, setElementCount] = useState(0);
  const [imgLoading, setImgLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [outOfZone, setOutOfZone] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  // Currently selected design object + a tick to re-render after edits.
  const [selected, setSelected] = useState<fabric.FabricObject | null>(null);
  const [, setEditTick] = useState(0);
  const imgCache = useRef<Map<string, fabric.FabricImage>>(new Map());
  const zonesRef = useRef<{ left: number; top: number; width: number; height: number }[]>([]);

  // A design object is "in zone" when its centre lies within any print zone.
  const checkZones = useCallback(() => {
    const c = canvasRef.current;
    if (!c || zonesRef.current.length === 0) { setOutOfZone(false); return; }
    const objs = c.getObjects().filter((o: any) => !o.__zone);
    const bad = objs.some((o: any) => {
      const r = o.getBoundingRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return !zonesRef.current.some((z) => cx >= z.left && cx <= z.left + z.width && cy >= z.top && cy <= z.top + z.height);
    });
    setOutOfZone(bad);
  }, []);
  const checkZonesRef = useRef(checkZones);
  checkZonesRef.current = checkZones;

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

  useEffect(() => {
    if (p?.name) setPageMeta({ title: `${p.name} gestalten | Private Shirt`, description: `${p.name} selbst gestalten: Text, Logo oder Foto platzieren.`, path: `/gestalten/${p.slug}` });
  }, [p?.name]);

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
    const onChange = () => { recountRef.current(); checkZonesRef.current(); };
    c.on("object:added", onChange);
    c.on("object:removed", onChange);
    c.on("object:modified", () => checkZonesRef.current());
    c.on("object:moving", () => checkZonesRef.current());
    c.on("object:scaling", () => checkZonesRef.current());
    const onSelect = () => setSelected(c.getActiveObject() ?? null);
    c.on("selection:created", onSelect);
    c.on("selection:updated", onSelect);
    c.on("selection:cleared", () => setSelected(null));
    loadView(view, variant);

    // Phones: keep the 480px design space but display it smaller (CSS only);
    // fabric maps pointer coordinates through the CSS scale itself.
    const wrap = canvasWrapRef.current;
    const fit = () => {
      const avail = wrap?.parentElement?.clientWidth ?? SIZE;
      const px = Math.min(SIZE, Math.max(240, avail - 32));
      c.setDimensions({ width: `${px}px`, height: `${px}px` }, { cssOnly: true });
      c.calcOffset();
    };
    fit();
    const ro = wrap?.parentElement ? new ResizeObserver(fit) : null;
    if (ro && wrap?.parentElement) ro.observe(wrap.parentElement);

    return () => {
      ro?.disconnect();
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
      zonesRef.current = zones.map((z: any) => ({
        left: z.x * SIZE, top: z.y * SIZE, width: z.width * SIZE, height: z.height * SIZE,
      }));
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
          // Guides are UI only: keep them out of toJSON(), otherwise a view
          // switch would save the guide as a design element (extra charge,
          // printed dashed box).
          excludeFromExport: true,
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
      checkZonesRef.current();
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

  /**
   * Renders the canvas to PNG without the print-zone guides; with
   * `transparent` also without garment image and white background (the
   * actual print file — white text must survive).
   */
  function exportPng(c: fabric.Canvas, multiplier: number, transparent = false) {
    const guides = c.getObjects().filter((o: any) => o.__zone);
    const bgImage = c.backgroundImage;
    const bgColor = c.backgroundColor;
    guides.forEach((g) => g.set({ visible: false }));
    if (transparent) {
      c.backgroundImage = undefined;
      c.backgroundColor = "";
    }
    try {
      c.renderAll();
      return c.toDataURL({ format: "png", multiplier });
    } finally {
      guides.forEach((g) => g.set({ visible: true }));
      c.backgroundImage = bgImage;
      c.backgroundColor = bgColor;
      c.renderAll();
    }
  }

  /** Print zone of the current view (or the whole canvas if none). */
  function placementBox() {
    return zonesRef.current[0] ?? { left: 0, top: 0, width: SIZE, height: SIZE };
  }

  function addText() {
    const c = canvasRef.current;
    if (!c) return;
    const z = placementBox();
    const t = new fabric.Textbox("Dein Text", {
      left: z.left + z.width / 2 - 80,
      top: z.top + z.height / 2 - 15,
      fontSize: 28,
      fontFamily: "Outfit",
      fill: contrastText(variant?.hex ?? variant?.colors?.hex),
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
      // Fit into the print zone (80 % of it), centred.
      const z = placementBox();
      const scale = Math.min((z.width * 0.8) / (img.width || 1), (z.height * 0.8) / (img.height || 1));
      img.scale(scale);
      img.set({
        left: z.left + z.width / 2 - (img.width! * scale) / 2,
        top: z.top + z.height / 2 - (img.height! * scale) / 2,
      });
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
      c.discardActiveObject();
      c.renderAll();
      setSelected(null);
    }
  }
  const deleteRef = useRef(deleteSelected);
  deleteRef.current = deleteSelected;

  // Entf/Backspace deletes the selection — but not while typing in a text box
  // or in a form field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      const obj: any = canvasRef.current?.getActiveObject();
      if (!obj || obj.isEditing) return;
      e.preventDefault();
      deleteRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Applies style props to the selected text and re-renders. */
  function styleText(props: Record<string, unknown>) {
    const c = canvasRef.current;
    const obj = c?.getActiveObject();
    if (!c || !obj) return;
    obj.set(props);
    obj.setCoords();
    c.requestRenderAll();
    checkZonesRef.current();
    setEditTick((t) => t + 1);
  }
  const selectedText: any = selected && (selected.type === "textbox" || selected.type === "i-text") ? selected : null;

  const totalPieces = Object.values(sizeQty).reduce((s, q) => s + (q || 0), 0);

  async function handleAddToCart() {
    if (!p || adding) return;
    const entries = Object.entries(sizeQty).filter(([, q]) => q > 0);
    if (entries.length === 0) return;
    setAdding(true);
    setAddError(null);
    saveView(view);
    const originalView = view;
    try {
      const c = canvasRef.current!;
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

        // composite (garment + design) — print files are required, so any
        // upload error aborts instead of producing an order without artwork.
        await uploadDesignFile(designId, `${v}-composite.png`, exportPng(c, 1.5));
        if (!thumbnail) thumbnail = exportPng(c, 0.28); // tiny cart preview

        // design-only print file (transparent, no garment, no guides)
        await uploadDesignFile(designId, `${v}-design.png`, exportPng(c, 2, true));

        // each element separately
        const live = c.getObjects().filter((o: any) => !o.__zone);
        for (let i = 0; i < live.length; i++) {
          const o: any = live[i];
          const png = o.toDataURL({ format: "png", multiplier: 2 });
          await uploadDesignFile(designId, `${v}-element-${i + 1}.png`, png);
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
    } catch (e) {
      console.error(e);
      setAddError("Dein Design konnte nicht gespeichert werden. Bitte versuche es erneut.");
      await loadView(originalView, variant);
    } finally {
      setAdding(false);
    }
  }

  async function handleDownload() {
    if (!p || !canvasRef.current) return;
    setDownloading(true);
    const originalView = view;
    saveView(view);

    const downloads: { view: string; dataUrl: string }[] = [];

    // For every view that has design objects: generate composite image
    for (const v of VIEWS) {
      const objs = (viewJson.current[v]?.objects ?? []).filter((o: any) => !o.__zone);
      if (objs.length === 0) continue;
      
      await loadView(v, variant);
      const c = canvasRef.current;
      if (!c) continue;

      try {
        downloads.push({ view: v, dataUrl: exportPng(c, 2) });
      } catch { /* skip */ }
    }

    if (downloads.length === 0) {
      setDownloading(false);
      await loadView(originalView, variant);
      return;
    }

    // Download all images
    for (const d of downloads) {
      const a = document.createElement("a");
      a.href = d.dataUrl;
      a.download = `${p.name}-${variant.colors?.name}-${VIEW_LABEL[d.view]}.png`;
      a.click();
    }

    await loadView(originalView, variant);
    setDownloading(false);
  }

  const availForSize = (sid: string) =>
    variant?.variant_size_availability?.find((a: any) => a.size_id === sid && a.available && a.stock > 0);
  const unit = p ? Number(p.base_price) + elementCount * Number(p.design_element_price) : 0;
  const fileRef = useRef<HTMLInputElement>(null);

  if (productLoading) return <p className="text-muted-foreground">Lade…</p>;
  if (productError) return <p className="text-destructive">Produkt konnte nicht geladen werden. Bitte Seite neu laden.</p>;
  if (!p) return <NotFound />;

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
        <div className="min-w-0 lg:col-span-2">
          <div className="grid grid-cols-4 gap-1 rounded-2xl border bg-card p-2 shadow-sm lg:flex lg:flex-col lg:gap-2">
            <Button variant="ghost" className="h-11 w-full flex-col justify-center gap-0.5 rounded-xl px-1 text-xs font-medium lg:flex-row lg:justify-start lg:gap-2.5 lg:px-4 lg:text-sm" onClick={addText}>
              <Type className="h-4 w-4 shrink-0" /> Text
            </Button>
            <Button variant="ghost" className="h-11 w-full flex-col justify-center gap-0.5 rounded-xl px-1 text-xs font-medium lg:flex-row lg:justify-start lg:gap-2.5 lg:px-4 lg:text-sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4 shrink-0" /> Bild
            </Button>
            <Button
              variant="ghost"
              className="h-11 w-full flex-col justify-center gap-0.5 rounded-xl px-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive lg:flex-row lg:justify-start lg:gap-2.5 lg:px-4 lg:text-sm"
              onClick={deleteSelected}
              disabled={!selected}
              title={selected ? "Auswahl löschen (Entf)" : "Erst ein Element auswählen"}
            >
              <Trash2 className="h-4 w-4 shrink-0" /> Löschen
            </Button>
            <Button
              variant="ghost"
              className="h-11 w-full flex-col justify-center gap-0.5 rounded-xl px-1 text-xs font-medium lg:flex-row lg:justify-start lg:gap-2.5 lg:px-4 lg:text-sm"
              onClick={handleDownload}
              disabled={downloading || elementCount === 0}
            >
              <Download className="h-4 w-4 shrink-0" /> {downloading ? "Lade..." : "Download"}
            </Button>
            {imageError && <p role="alert" className="col-span-4 px-2 pb-1 text-xs text-destructive">{imageError}</p>}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (!f.type.startsWith("image/")) { setImageError("Bitte eine Bilddatei (PNG, JPG, SVG) wählen."); return; }
                if (f.size > 15 * 1024 * 1024) { setImageError("Das Bild ist größer als 15 MB."); return; }
                setImageError(null);
                addImage(f);
              }}
            />
          </div>
        </div>

        {/* Canvas + views */}
        <div className="min-w-0 lg:col-span-6">
          <div className="flex items-center justify-center rounded-2xl bg-muted/30 p-2 sm:p-6">
            <div ref={canvasWrapRef} className="relative overflow-hidden rounded-xl bg-white shadow-sm">
              <canvas ref={canvasElRef} width={SIZE} height={SIZE} />
              {imgLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              {outOfZone && !imgLoading && (
                <div className="absolute inset-x-3 top-3 flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground shadow-lg">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> Motiv außerhalb der Druckzone
                </div>
              )}
            </div>
          </div>

          {selectedText && (
            <div className="mt-5 space-y-3 rounded-2xl border bg-card p-3 shadow-sm" aria-label="Text bearbeiten">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Text bearbeiten · Doppelklick zum Ändern</p>
              <div className="flex flex-wrap items-center gap-2">
                {TEXT_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    aria-label={`Textfarbe ${col}`}
                    onClick={() => styleText({ fill: col })}
                    className={"h-7 w-7 rounded-full border-2 " + (selectedText.fill === col ? "border-primary ring-2 ring-primary/30" : "border-border")}
                    style={{ backgroundColor: col }}
                  />
                ))}
                <label className="flex h-7 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground">
                  eigene
                  <input
                    type="color"
                    aria-label="Eigene Textfarbe"
                    value={typeof selectedText.fill === "string" && selectedText.fill.startsWith("#") ? selectedText.fill : "#111111"}
                    onChange={(e) => styleText({ fill: e.target.value })}
                    className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Schriftart"
                  value={selectedText.fontFamily}
                  onChange={(e) => styleText({ fontFamily: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Schrift kleiner"
                    onClick={() => styleText({ fontSize: Math.max(10, (selectedText.fontSize ?? 28) - 4) })}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center text-sm tabular-nums">{Math.round(selectedText.fontSize ?? 28)}</span>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Schrift größer"
                    onClick={() => styleText({ fontSize: Math.min(160, (selectedText.fontSize ?? 28) + 4) })}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button type="button" variant={selectedText.fontWeight === "bold" ? "default" : "outline"} size="icon" className="h-9 w-9"
                  aria-label="Fett" aria-pressed={selectedText.fontWeight === "bold"}
                  onClick={() => styleText({ fontWeight: selectedText.fontWeight === "bold" ? "normal" : "bold" })}>
                  <Bold className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

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
                      <img loading="lazy" decoding="async" src={publicUrl(img.storage_path)} alt={VIEW_LABEL[v]} className="h-full w-full object-cover" />
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
        <div className="min-w-0 lg:col-span-4">
          <div className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-bold">{p.name}</h2>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{eur(unit)}</p>
              <p className="text-xs text-muted-foreground">
                Basis {eur(Number(p.base_price))} + {elementCount} Element(e) × {eur(Number(p.design_element_price))} · {PRICE_NOTE}
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
                        style={{ backgroundColor: v.hex ?? v.colors?.hex }}
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
                  <span className="font-bold tabular-nums">{eur((unit * totalPieces))}</span>
                </div>
                {outOfZone && (
                  <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> Ein Motiv liegt außerhalb der Druckzone und wird evtl. nicht vollständig gedruckt.
                  </p>
                )}
                <Button className="w-full" size="lg" disabled={totalPieces === 0 || adding} onClick={handleAddToCart}>
                  {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                  {adding ? "Design wird gespeichert…" : "In den Warenkorb"}
                </Button>
                {addError && <p role="alert" className="text-center text-sm text-destructive">{addError}</p>}
                {totalPieces === 0 && <p className="text-center text-xs text-muted-foreground">Mindestens 1 Stück wählen.</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
