import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as fabric from "fabric";
import { Type, ImagePlus, Trash2, ShoppingCart, Loader2, ArrowRight, ArrowLeft, AlertTriangle, Download, Bold, Minus, Plus, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { publicUrl } from "@/lib/storage";
import { dataUrlToBlob, uploadDesignBlob, uploadDesignJson } from "@/lib/design-upload";
import {
  DESIGN_CANVAS_PX, PLACEHOLDER_TEXT, TEXT_ELEMENT_MAX_EDGE, IMAGE_ELEMENT_MAX_EDGE, IMAGE_ACCEPT, MAX_IMAGE_PIXELS,
  toZones, cmPerPx, scaleZone, insideBox, printCrop, printInfo, elementCm, imageDpi, reviewDesign, countDesignElements,
  renderPrintPng, renderElementPng, imageFileProblem, imageMime, originalExt, isTextType, isImageType, type Zone,
} from "@/lib/designer-print";
import { availableFonts, DEFAULT_FONT, loadBundledFonts, renderedFont } from "@/lib/designer-fonts";
import { deleteDraft, draftElementCount, loadDraft, saveDraft, type DraftAsset, type DraftSaveStatus } from "@/lib/designer-draft";
import { DraftBanner } from "@/components/designer/DraftBanner";
import { PrintApproval } from "@/components/designer/PrintApproval";
import { ImageQuality } from "@/components/designer/ImageQuality";
import { DeliveryTime } from "@/components/DeliveryTime";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/NotFound";
import { setPageMeta } from "@/lib/seo";
import { useCart } from "@/stores/cart";
import { PRICE_NOTE } from "@/lib/pricing";
import { eur } from "@/lib/utils";

const VIEWS = ["front", "back", "left", "right"] as const;
const VIEW_LABEL: Record<string, string> = { front: "Vorne", back: "Hinten", left: "Links", right: "Rechts" };
const SIZE = DESIGN_CANVAS_PX;

const TEXT_COLORS = ["#111111", "#ffffff", "#e6007e", "#f5b700", "#d32f2f", "#1565c0", "#2e7d32", "#7f8c8d"];

/** Readable default text colour for a garment colour (white on dark shirts). */
function contrastText(hex?: string | null) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return "#111111";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.5 ? "#ffffff" : "#111111";
}

/** WCAG relative luminance of a #rrggbb colour (null if not parseable). */
function luminance(hex?: string | null): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text colour that is hard to read on the garment (contrast ratio below 2:1). */
function lowContrast(fill: unknown, garment?: string | null) {
  const a = luminance(typeof fill === "string" ? fill : null);
  const b = luminance(garment);
  if (a === null || b === null) return false;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) < 2;
}

const garmentHex = (v: any): string | null => v?.hex ?? v?.colors?.hex ?? null;
const ownImage = (v: any, view: string) => v?.variant_images?.find((i: any) => i.view === view);

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

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function Designer() {
  const { slug } = useParams<{ slug: string }>();
  // One designer instance per product: canvas, design and draft are per slug.
  return <DesignerPage key={slug} slug={slug!} />;
}

function DesignerPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { data: p, isLoading: productLoading, error: productError } = useQuery({ queryKey: ["designer", slug], queryFn: () => fetchProduct(slug) });
  const addToCart = useCart((s) => s.add);

  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const viewJson = useRef<Record<string, any>>({});
  // Uploaded images by their blob: URL. The canvas (and its JSON) only holds
  // the short URL, never a base64 copy; the original file is uploaded as is.
  const assetsRef = useRef<Map<string, DraftAsset>>(new Map());

  const [variantIdx, setVariantIdx] = useState(0);
  const [view, setView] = useState<string>("front");
  const [sizeQty, setSizeQty] = useState<Record<string, number>>({}); // size_id -> quantity
  const [elementCount, setElementCount] = useState(0);
  const [imgLoading, setImgLoading] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [outOfZone, setOutOfZone] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [contrastHint, setContrastHint] = useState(0);
  const [draftOffer, setDraftOffer] = useState<{ savedAt: number; count: number } | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftSaveStatus | "idle">("idle");
  const [draftNote, setDraftNote] = useState<string | null>(null);
  // Currently selected design object + a tick to re-render after edits.
  const [selected, setSelected] = useState<fabric.FabricObject | null>(null);
  const [, setEditTick] = useState(0);
  const imgCache = useRef<Map<string, fabric.FabricImage>>(new Map());
  const zonesRef = useRef<Zone[]>([]);
  // While a view loads the canvas is incomplete: never save it then (that
  // would wipe the view's design). While busy (upload/download) the canvas
  // cycles through the views: no edits, no view/colour switches.
  const loadingRef = useRef(false);
  const busyRef = useRef(false);
  const busy = adding || downloading;

  const variants = (p?.variants ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);
  const variant: any = variants[variantIdx];
  const sizes = (p?.product_sizes ?? []).map((ps: any) => ps.sizes).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const zonesByView = useMemo(() => {
    const m: Record<string, Zone[]> = {};
    for (const v of VIEWS) m[v] = toZones((p?.print_zones ?? []).filter((z: any) => z.view === v));
    return m;
  }, [p]);

  // Latest values for canvas listeners and timers.
  const viewRef = useRef(view);
  viewRef.current = view;
  const variantRef = useRef(variant);
  variantRef.current = variant;
  const elementCountRef = useRef(elementCount);
  elementCountRef.current = elementCount;
  const draftStatusRef = useRef(draftStatus);
  draftStatusRef.current = draftStatus;

  // An element is "in zone" when its whole bounding box lies within a print zone.
  const checkZones = useCallback(() => {
    const c = canvasRef.current;
    if (!c || zonesRef.current.length === 0) { setOutOfZone(false); return; }
    const bad = c.getObjects().filter((o: any) => !o.__zone).some((o) => {
      const r = o.getBoundingRect();
      return !zonesRef.current.some((z) => insideBox(r, z));
    });
    setOutOfZone(bad);
  }, []);
  const checkZonesRef = useRef(checkZones);
  checkZonesRef.current = checkZones;

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
  // Called on every real design edit (not on canvas reloads or exports).
  const designChangedRef = useRef<() => void>(() => {});
  const flushDraftRef = useRef<() => void>(() => {});

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
    const onEdit = () => { if (!loadingRef.current && !busyRef.current) designChangedRef.current(); };
    const onChange = () => { recountRef.current(); checkZonesRef.current(); onEdit(); };
    c.on("object:added", onChange);
    c.on("object:removed", onChange);
    c.on("object:modified", () => { checkZonesRef.current(); onEdit(); setEditTick((t) => t + 1); });
    c.on("object:moving", () => checkZonesRef.current());
    c.on("object:scaling", () => {
      checkZonesRef.current();
      if (isImageType(c.getActiveObject()?.type)) setEditTick((t) => t + 1); // live print quality
    });
    c.on("text:changed", () => { onEdit(); setEditTick((t) => t + 1); });
    // A text emptied while editing is neither printed nor charged.
    c.on("text:editing:exited", ({ target }) => {
      setTimeout(() => {
        if (canvasRef.current === c && c.getObjects().includes(target) && !String(target.text ?? "").trim()) {
          c.remove(target);
          c.requestRenderAll();
        }
      }, 0);
    });
    const onSelect = () => setSelected(c.getActiveObject() ?? null);
    c.on("selection:created", onSelect);
    c.on("selection:updated", onSelect);
    c.on("selection:cleared", () => setSelected(null));
    loadView(view, variant).catch(console.error);

    // Measure texts again once the bundled font is there (else the fallback's metrics stick).
    loadBundledFonts().then(() => {
      if (canvasRef.current !== c) return;
      fabric.cache.clearFontCache();
      c.getObjects().forEach((o: any) => {
        if (isTextType(o.type)) { o.initDimensions?.(); o.setCoords(); }
      });
      c.requestRenderAll();
    });

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
      flushDraftRef.current(); // snapshot pending edits before the canvas goes away
      c.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Release the in-memory image URLs when leaving the designer.
  useEffect(() => () => {
    for (const url of assetsRef.current.keys()) URL.revokeObjectURL(url);
  }, []);

  // Render a view of a specific variant: background image + zone guides + saved objects.
  // A monotonic token ensures only the latest load wins (variant/view can change fast).
  const loadTokenRef = useRef(0);
  const loadView = useCallback(
    async (targetView: string, targetVariant: any) => {
      const c = canvasRef.current;
      if (!c) return;
      const token = ++loadTokenRef.current;
      loadingRef.current = true;
      setViewLoading(true);
      try {
        c.remove(...c.getObjects());
        c.backgroundImage = undefined;

        // Only the variant's own photo of this view; never another view's photo
        // (a "Links" design on the front photo would mislead customer and print shop).
        const img = ownImage(targetVariant, targetView);
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
        const zones = zonesByView[targetView] ?? [];
        zonesRef.current = zones;
        for (const z of zones) {
          const rect = new fabric.Rect({
            left: z.left,
            top: z.top,
            width: z.width,
            height: z.height,
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
      } finally {
        if (token === loadTokenRef.current) {
          loadingRef.current = false;
          setViewLoading(false);
        }
      }
    },
    [zonesByView, recount]
  );

  // Save current view's objects to memory
  const saveView = useCallback((v: string) => {
    const c = canvasRef.current;
    if (!c || loadingRef.current) return; // mid-load the canvas is incomplete; viewJson[v] is still right
    const json = c.toJSON();
    json.objects = (json.objects || []).filter((o: any) => !o.__zone);
    viewJson.current[v] = json;
  }, []);

  /** All views incl. the live canvas, without touching viewJson (autosave, review). */
  function snapshotViews(): Record<string, any> {
    const out = { ...viewJson.current };
    const c = canvasRef.current;
    if (c && !loadingRef.current && !busyRef.current) {
      const json: any = c.toJSON();
      json.objects = (json.objects || []).filter((o: any) => !o.__zone);
      out[viewRef.current] = json;
    }
    return out;
  }

  // When variant or view changes, swap canvas content
  useEffect(() => {
    loadView(view, variant).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, variant?.id, p]);

  const viewHasDesign = (v: string) =>
    v === view ? elementCountOnCanvas() > 0 : ((viewJson.current[v]?.objects ?? []) as any[]).some((o) => !o.__zone);
  function elementCountOnCanvas() {
    return canvasRef.current?.getObjects().filter((o: any) => !o.__zone).length ?? 0;
  }

  function switchView(v: string) {
    if (v === view || busyRef.current || loadingRef.current) return;
    saveView(view);
    setView(v);
  }

  function chooseVariant(i: number) {
    if (i === variantIdx || busyRef.current || loadingRef.current) return;
    saveView(view);
    const next = variants[i];
    setVariantIdx(i);
    setSizeQty({});
    // the new colour has no photo of this view and nothing is designed there: back to front
    if (view !== "front" && !ownImage(next, view) && !viewHasDesign(view)) setView("front");
    // texts that become unreadable on the new colour (black on black …)
    let n = 0;
    for (const v of VIEWS) {
      for (const o of (viewJson.current[v]?.objects ?? []) as any[]) {
        if (isTextType(o.type) && lowContrast(o.fill, garmentHex(next))) n++;
      }
    }
    setContrastHint(n);
    designChangedRef.current();
  }

  /** Gives every hard-to-read text the default contrast colour of the current garment. */
  function fixTextContrast() {
    if (busyRef.current) return;
    // While the new colour loads, viewJson is already current (chooseVariant saved it);
    // the reload below supersedes that load.
    saveView(view);
    const hex = garmentHex(variant);
    for (const v of VIEWS) {
      for (const o of (viewJson.current[v]?.objects ?? []) as any[]) {
        if (isTextType(o.type) && lowContrast(o.fill, hex)) o.fill = contrastText(hex);
      }
    }
    setContrastHint(0);
    loadView(view, variant).catch(console.error);
    designChangedRef.current();
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
    if (!c || busyRef.current || loadingRef.current) return;
    const z = placementBox();
    const width = Math.min(160, Math.max(60, z.width * 0.9));
    const t = new fabric.Textbox(PLACEHOLDER_TEXT, {
      left: z.left + z.width / 2 - width / 2,
      top: z.top + z.height / 2 - 15,
      fontSize: 28,
      fontFamily: DEFAULT_FONT,
      fill: contrastText(garmentHex(variant)),
      width,
      textAlign: "center",
    });
    c.add(t);
    c.setActiveObject(t);
    c.renderAll();
  }

  async function addImage(file: File) {
    const c = canvasRef.current;
    if (!c) return;
    const problem = imageFileProblem(file);
    if (problem) { setToolError(problem); return; }
    setToolError(null);
    const type = imageMime(file)!;
    // SVGs only decode from a blob with the right type (some systems report none).
    const blob = file.type === type ? file : new Blob([file], { type });
    const url = URL.createObjectURL(blob);
    let img: fabric.FabricImage;
    try {
      img = await fabric.FabricImage.fromURL(url);
      if (!img.width || !img.height) throw new Error("image without size");
    } catch {
      URL.revokeObjectURL(url);
      setToolError(type === "image/svg+xml"
        ? "Diese SVG-Datei kann nicht angezeigt werden (beschädigt oder ohne Größenangabe). Bitte als PNG exportieren."
        : "Das Bild konnte nicht gelesen werden – die Datei ist beschädigt oder das Format wird nicht unterstützt. Bitte PNG oder JPG verwenden.");
      return;
    }
    if (img.width * img.height > MAX_IMAGE_PIXELS) {
      URL.revokeObjectURL(url);
      setToolError("Das Bild ist zu groß (mehr als 50 Megapixel). Bitte verkleinere es und lade es erneut hoch.");
      return;
    }
    if (canvasRef.current !== c || busyRef.current || loadingRef.current) {
      URL.revokeObjectURL(url);
      setToolError("Das Bild konnte gerade nicht eingefügt werden. Bitte versuche es erneut.");
      return;
    }
    assetsRef.current.set(url, { id: crypto.randomUUID(), blob, name: file.name.slice(0, 120), type });
    // Fit into the print zone (80 % of it), centred.
    const z = placementBox();
    const scale = Math.min((z.width * 0.8) / img.width, (z.height * 0.8) / img.height);
    img.scale(scale);
    img.set({
      left: z.left + z.width / 2 - (img.width * scale) / 2,
      top: z.top + z.height / 2 - (img.height * scale) / 2,
    });
    c.add(img);
    c.setActiveObject(img);
    c.renderAll();
  }

  function deleteSelected() {
    const c = canvasRef.current;
    if (!c || busyRef.current) return;
    // getActiveObjects() also covers a multi-selection (an ActiveSelection is not on the canvas itself)
    const objs = c.getActiveObjects().filter((o: any) => !o.__zone);
    if (!objs.length) return;
    c.discardActiveObject();
    c.remove(...objs);
    c.requestRenderAll();
    setSelected(null);
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
      if (!obj || obj.isEditing || busyRef.current) return;
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
    if (!c || !obj || busyRef.current) return;
    obj.set(props);
    obj.setCoords();
    c.requestRenderAll();
    checkZonesRef.current();
    setEditTick((t) => t + 1);
    designChangedRef.current();
  }
  const selectedText: any = selected && isTextType(selected.type) ? selected : null;
  const selectedImage: any = selected && isImageType(selected.type) ? selected : null;
  const isVectorSrc = (src: string) => assetsRef.current.get(src)?.type === "image/svg+xml";
  const fontOptions = useMemo(() => availableFonts(), []);

  // --- local draft (autosave) ------------------------------------------------
  const persistedAssetsRef = useRef<Set<string>>(new Set()); // image ids already in the draft store
  const draftCheckedRef = useRef(false);
  const draftOfferRef = useRef(false); // an unanswered offer must not be overwritten
  const pendingDraftRef = useRef<Awaited<ReturnType<typeof loadDraft>>>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const draftChainRef = useRef<Promise<void>>(Promise.resolve());

  function scheduleDraftSave() {
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = undefined;
      draftChainRef.current = draftChainRef.current.then(() => persistDraftRef.current()).catch(() => {});
    }, 800);
  }

  async function persistDraft() {
    if (!draftCheckedRef.current || draftOfferRef.current) return;
    if (loadingRef.current || busyRef.current) { scheduleDraftSave(); return; }
    const views = snapshotViews();
    if (countDesignElements(views) === 0) {
      persistedAssetsRef.current = new Set();
      await deleteDraft(slug);
      setDraftStatus("idle");
      return;
    }
    const referenced: string[] = [];
    const out: Record<string, any> = {};
    for (const [v, json] of Object.entries(views)) {
      if (!json) continue;
      out[v] = {
        ...json,
        objects: ((json.objects ?? []) as any[]).flatMap((o) => {
          if (!isImageType(o.type)) return [o];
          const asset = assetsRef.current.get(o.src);
          if (!asset) return [];
          if (!referenced.includes(asset.id)) referenced.push(asset.id);
          return [{ ...o, src: `asset:${asset.id}` }];
        }),
      };
    }
    const byId = new Map([...assetsRef.current.values()].map((a) => [a.id, a]));
    const persisted = persistedAssetsRef.current;
    const newAssets = referenced.filter((id) => !persisted.has(id)).map((id) => byId.get(id)!).filter(Boolean);
    const orphans = [...persisted].filter((id) => !referenced.includes(id));
    const res = await saveDraft(
      { slug, savedAt: Date.now(), variantId: variantRef.current?.id ?? null, views: out, assetIds: referenced },
      newAssets,
      orphans,
    );
    persistedAssetsRef.current = new Set(res.assetIds);
    setDraftStatus(res.status);
  }
  const persistDraftRef = useRef(persistDraft);
  persistDraftRef.current = persistDraft;

  designChangedRef.current = () => {
    setApproved(false);
    scheduleDraftSave();
  };
  flushDraftRef.current = () => {
    if (saveTimerRef.current === undefined) return;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = undefined;
    void persistDraftRef.current().catch(() => {}); // snapshot is taken synchronously
  };

  // Offer a saved draft of this product once the designer is ready.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    loadDraft(slug).then((d) => {
      if (!alive) return;
      const count = d ? draftElementCount(d.draft) : 0;
      if (d && count > 0) {
        pendingDraftRef.current = d;
        draftOfferRef.current = true;
        setDraftOffer({ savedAt: d.draft.savedAt, count });
      }
      draftCheckedRef.current = true;
      if (!draftOfferRef.current && elementCountRef.current > 0) scheduleDraftSave();
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, slug]);

  async function restoreDraft() {
    const d = pendingDraftRef.current;
    pendingDraftRef.current = null;
    draftOfferRef.current = false;
    setDraftOffer(null);
    if (!d || busyRef.current) return;
    let dropped = !!d.draft.imagesDropped;
    const restored = new Set<string>();
    const views: Record<string, any> = {};
    for (const [v, json] of Object.entries(d.draft.views ?? {})) {
      views[v] = {
        ...json,
        objects: (((json as any)?.objects ?? []) as any[]).flatMap((o) => {
          if (!isImageType(o.type)) return [o];
          const id = typeof o.src === "string" && o.src.startsWith("asset:") ? o.src.slice(6) : "";
          const asset = d.assets.get(id);
          if (!asset) { dropped = true; return []; }
          const url = URL.createObjectURL(asset.blob);
          assetsRef.current.set(url, asset);
          restored.add(asset.id);
          return [{ ...o, src: url }];
        }),
      };
    }
    viewJson.current = views;
    persistedAssetsRef.current = restored;
    setDraftNote(dropped ? "Nicht alle Bilder waren im Entwurf gespeichert – bitte lade fehlende Bilder erneut hoch." : null);
    setApproved(false);
    const vi = variants.findIndex((v: any) => v.id === d.draft.variantId);
    if (vi >= 0) setVariantIdx(vi);
    setView("front");
    await loadView("front", vi >= 0 ? variants[vi] : variant).catch(console.error);
    scheduleDraftSave();
  }

  function discardDraft() {
    pendingDraftRef.current = null;
    draftOfferRef.current = false;
    setDraftOffer(null);
    persistedAssetsRef.current = new Set();
    void deleteDraft(slug).then(() => { if (elementCountRef.current > 0) scheduleDraftSave(); });
  }

  // Warn before closing the tab while uploading, or when the draft could not be saved fully.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const unsaved = elementCountRef.current > 0 && (draftStatusRef.current === "off" || draftStatusRef.current === "noImages");
      if (busyRef.current || unsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const totalPieces = Object.values(sizeQty).reduce((s, q) => s + (q || 0), 0);

  /** Removes texts that were emptied (they would be charged but print nothing). */
  function pruneEmptyTexts() {
    for (const v of VIEWS) {
      const json = viewJson.current[v];
      if (json?.objects) json.objects = json.objects.filter((o: any) => !(isTextType(o.type) && !String(o.text ?? "").trim()));
    }
  }

  async function handleAddToCart() {
    if (!p || busyRef.current || loadingRef.current) return;
    const entries = Object.entries(sizeQty).filter(([, q]) => q > 0);
    if (entries.length === 0) return;
    if (elementCount > 0 && !approved) { setAddError("Bitte bestätige zuerst die Druckfreigabe."); return; }
    busyRef.current = true;
    setAdding(true);
    setAddError(null);
    setUploadedFiles(0);
    saveView(view);
    pruneEmptyTexts();
    const originalView = view;
    try {
      await loadBundledFonts();
      const c = canvasRef.current!;
      const designId = crypto.randomUUID();
      const approvedAt = new Date().toISOString();
      const manifest: any[] = [];
      const designJson: Record<string, any> = {}; // uploaded as design.json (contract: keyed by view)
      const originals = new Map<string, string>(); // image blob: URL -> uploaded original file name
      let thumbnail: string | undefined;
      // Print files are required, so any upload error aborts instead of
      // producing an order without artwork.
      const put = (name: string, blob: Blob, type: string) =>
        uploadDesignBlob(designId, name, blob, type).then(() => setUploadedFiles((n) => n + 1));

      // For every view with design objects: composite, design-only, print file, originals, each element.
      for (const v of VIEWS) {
        const saved = viewJson.current[v];
        if (!((saved?.objects ?? []) as any[]).some((o) => !o.__zone)) continue;
        await loadView(v, variant);
        const uploads: Promise<unknown>[] = [];

        // composite (garment + design) and the old full-canvas design-only file
        uploads.push(put(`${v}-composite.png`, dataUrlToBlob(exportPng(c, 1.5)), "image/png"));
        if (!thumbnail) thumbnail = exportPng(c, 0.28); // tiny cart preview
        uploads.push(put(`${v}-design.png`, dataUrlToBlob(exportPng(c, 2, true)), "image/png"));

        // print file: cropped to the print zone, ~4000 px, transparent, no guides
        const live = c.getObjects().filter((o: any) => !o.__zone);
        const zones = zonesRef.current;
        const crop = printCrop(live.map((o) => o.getBoundingRect()), zones);
        const printPng = await renderPrintPng(c, crop.rect);
        const print = printInfo(`${v}-print.png`, crop, printPng);
        uploads.push(put(print.file, printPng.blob, "image/png"));

        let originalNo = 0;
        for (let i = 0; i < live.length; i++) {
          const o: any = live[i];
          const isText = isTextType(o.type);
          const isImage = isImageType(o.type);
          const r = o.getBoundingRect();
          let original: string | undefined;
          let vector = false;
          if (isImage) {
            const src: string = o.getSrc();
            const asset = assetsRef.current.get(src);
            vector = asset?.type === "image/svg+xml";
            original = originals.get(src);
            if (!original) {
              const blob = asset?.blob ?? (await (await fetch(src)).blob());
              const type = asset?.type ?? (blob.type || "application/octet-stream");
              original = `${v}-original-${++originalNo}.${originalExt(type)}`;
              originals.set(src, original);
              uploads.push(put(original, blob, type));
            }
          }
          const file = `${v}-element-${i + 1}.png`;
          const cm = elementCm(r, crop);
          manifest.push({
            view: v,
            index: i + 1,
            type: o.type,
            text: isText ? o.text : undefined,
            fontFamily: o.fontFamily,
            fontRendered: isText ? renderedFont(o.fontFamily) : undefined,
            fill: o.fill,
            left: Math.round(o.left),
            top: Math.round(o.top),
            width: Math.round(o.getScaledWidth?.() ?? o.width),
            height: Math.round(o.getScaledHeight?.() ?? o.height),
            angle: Math.round(o.angle ?? 0),
            // print data, flat primitives only (the checkout keeps whitelisted primitive keys)
            file,
            printFile: print.file,
            printCmW: print.cm.w,
            printCmH: print.cm.h,
            printDpi: print.dpi ?? undefined,
            zone: print.zone ?? undefined,
            clipped: print.clipped,
            cmLeft: cm.left, // element bounding box within the print file
            cmTop: cm.top,
            cmWidth: cm.width,
            cmHeight: cm.height,
            sizeEstimated: print.sizeEstimated,
            original,
            sourceW: isImage ? o.width : undefined,
            sourceH: isImage ? o.height : undefined,
            dpi: isImage && !vector ? imageDpi(o, cmPerPx(scaleZone(r, zones))) : undefined,
            approvedAt,
          });
          const elPng = await renderElementPng(o, isImage ? IMAGE_ELEMENT_MAX_EDGE : TEXT_ELEMENT_MAX_EDGE, printPng.multiplier);
          uploads.push(put(file, elPng.blob, "image/png"));
        }
        await Promise.all(uploads);

        // design.json references the uploaded originals instead of embedding them
        designJson[v] = {
          ...saved,
          objects: (saved.objects as any[]).map((o) =>
            isImageType(o.type) && originals.has(o.src)
              ? { ...o, src: `${designId}/${originals.get(o.src)}`, originalFile: originals.get(o.src) }
              : o),
          print,
        };
        c.renderAll();
      }

      const anyDesign = Object.keys(designJson).length > 0;
      if (anyDesign) {
        await uploadDesignJson(designId, designJson);
      }
      // Same rule as the checkout server: every non-guide object in design.json.
      const designElementCount = countDesignElements(designJson);

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
          designElementCount,
          designId: anyDesign ? designId : undefined,
          designManifest: anyDesign ? manifest : undefined,
          thumbnail,
        });
      }
      await loadView(originalView, variant);
      busyRef.current = false;
      navigate("/warenkorb");
    } catch (e) {
      console.error(e);
      setAddError("Dein Design konnte nicht gespeichert werden. Bitte prüfe deine Verbindung und versuche es erneut.");
      await loadView(originalView, variant).catch(console.error);
    } finally {
      busyRef.current = false;
      setAdding(false);
    }
  }

  /** Mockup PNG per designed view; several views come as one ZIP (browsers block multiple downloads). */
  async function handleDownload() {
    if (!p || !canvasRef.current || busyRef.current || loadingRef.current) return;
    busyRef.current = true;
    setDownloading(true);
    setToolError(null);
    const originalView = view;
    saveView(view);
    try {
      const base = `${p.name}-${variant?.colors?.name ?? ""}`.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "design";
      const files: { name: string; blob: Blob }[] = [];
      for (const v of VIEWS) {
        if (!((viewJson.current[v]?.objects ?? []) as any[]).some((o) => !o.__zone)) continue;
        await loadView(v, variant);
        files.push({ name: `${base}-${VIEW_LABEL[v]}.png`, blob: dataUrlToBlob(exportPng(canvasRef.current!, 2)) });
      }
      if (files.length === 1) {
        saveFile(files[0].blob, files[0].name);
      } else if (files.length > 1) {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        files.forEach((f) => zip.file(f.name, f.blob));
        saveFile(await zip.generateAsync({ type: "blob" }), `${base}.zip`);
      }
    } catch (e) {
      console.error(e);
      setToolError("Der Download ist fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      await loadView(originalView, variant).catch(console.error);
      busyRef.current = false;
      setDownloading(false);
    }
  }

  const availForSize = (sid: string) =>
    variant?.variant_size_availability?.find((a: any) => a.size_id === sid && a.available && a.stock > 0);
  const unit = p ? Number(p.base_price) + elementCount * Number(p.design_element_price) : 0;
  const fileRef = useRef<HTMLInputElement>(null);

  if (productLoading) return <p className="text-muted-foreground">Lade…</p>;
  if (productError) return <p className="text-destructive">Produkt konnte nicht geladen werden. Bitte Seite neu laden.</p>;
  if (!p) return <NotFound />;

  const locked = busy || viewLoading;
  // Only views with their own garment photo — plus views that already carry a design.
  const shownViews = VIEWS.filter((v) => v === "front" || v === view || ownImage(variant, v) || viewHasDesign(v));
  const viewZones = zonesByView[view] ?? [];
  const review = step === 2 && elementCount > 0 && !busy
    ? reviewDesign(snapshotViews(), (v) => zonesByView[v] ?? [], isVectorSrc, VIEW_LABEL)
    : null;
  let imageQuality: { dpi: number; cmW: number; cmH: number; estimated: boolean; vector: boolean } | null = null;
  if (selectedImage && !busy) {
    const s = cmPerPx(scaleZone(selectedImage.getBoundingRect(), zonesRef.current));
    imageQuality = {
      dpi: imageDpi(selectedImage, s),
      cmW: selectedImage.getScaledWidth() * s.x,
      cmH: selectedImage.getScaledHeight() * s.y,
      estimated: s.estimated,
      vector: isVectorSrc(selectedImage.getSrc()),
    };
  }
  const fonts = selectedText && !fontOptions.some((f) => f.family === selectedText.fontFamily)
    ? [...fontOptions, { label: String(selectedText.fontFamily), family: String(selectedText.fontFamily) }]
    : fontOptions;
  const toolCls = "h-11 w-full flex-col justify-center gap-0.5 rounded-xl px-1 text-xs font-medium lg:flex-row lg:justify-start lg:gap-2.5 lg:px-4 lg:text-sm";

  return (
    <div>
      <div className="mb-6">
        <Link to={`/produkt/${p.slug}`} className="text-sm text-muted-foreground hover:text-primary">← zurück zum produkt</Link>
        <h1 className="mt-2 text-3xl font-black lowercase sm:text-4xl">
          <span className="text-primary">creator</span>
          <span className="text-muted-foreground"> · {p.name}</span>
        </h1>
      </div>

      {draftOffer && !busy && (
        <DraftBanner savedAt={draftOffer.savedAt} count={draftOffer.count} onRestore={restoreDraft} onDiscard={discardDraft} />
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Tool rail */}
        <div className="min-w-0 lg:col-span-2">
          <div className="grid grid-cols-4 gap-1 rounded-2xl border bg-card p-2 shadow-sm lg:flex lg:flex-col lg:gap-2">
            <Button variant="ghost" className={toolCls} onClick={addText} disabled={locked}>
              <Type className="h-4 w-4 shrink-0" /> Text
            </Button>
            <Button variant="ghost" className={toolCls} onClick={() => fileRef.current?.click()} disabled={locked}>
              <ImagePlus className="h-4 w-4 shrink-0" /> Bild
            </Button>
            <Button
              variant="ghost"
              className={toolCls + " text-muted-foreground hover:bg-destructive/10 hover:text-destructive"}
              onClick={deleteSelected}
              disabled={!selected || locked}
              title={selected ? "Auswahl löschen (Entf)" : "Erst ein Element auswählen"}
            >
              <Trash2 className="h-4 w-4 shrink-0" /> Löschen
            </Button>
            <Button
              variant="ghost"
              className={toolCls}
              onClick={handleDownload}
              disabled={locked || elementCount === 0}
              title="Vorschau-Bilder deiner Gestaltung herunterladen"
            >
              <Download className="h-4 w-4 shrink-0" /> {downloading ? "Lade..." : "Download"}
            </Button>
            {toolError && <p role="alert" className="col-span-4 px-2 pb-1 text-xs text-destructive">{toolError}</p>}
            <p className="col-span-4 hidden px-2 pb-1 text-[11px] leading-snug text-muted-foreground lg:block">
              Bilder: PNG, JPG, WebP oder SVG, max. 15 MB.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void addImage(f);
              }}
            />
          </div>
        </div>

        {/* Canvas + views */}
        <div className="min-w-0 lg:col-span-6">
          <div className="flex items-center justify-center rounded-2xl bg-muted/30 p-2 sm:p-6">
            <div ref={canvasWrapRef} className="relative overflow-hidden rounded-xl bg-white shadow-sm">
              <canvas ref={canvasElRef} width={SIZE} height={SIZE} />
              {imgLoading && !busy && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              {busy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 text-center text-sm backdrop-blur-sm" aria-live="polite">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="font-medium">{adding ? "Druckdateien werden erstellt…" : "Download wird vorbereitet…"}</span>
                  {adding && uploadedFiles > 0 && <span className="text-xs text-muted-foreground">{uploadedFiles} Dateien hochgeladen</span>}
                </div>
              )}
              {outOfZone && !imgLoading && !busy && (
                <div className="absolute inset-x-3 top-3 flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground shadow-lg">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> Motiv ragt über die Druckzone hinaus
                </div>
              )}
              {!ownImage(variant, view) && !imgLoading && !busy && (
                <div className="absolute inset-x-3 bottom-3 rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                  Für diese Farbe gibt es kein Foto der Ansicht „{VIEW_LABEL[view]}“.
                </div>
              )}
            </div>
          </div>

          {viewZones.length === 0 && (
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
              Für diese Ansicht ist keine Druckzone markiert – platziere dein Motiv auf der Textilfläche. Die Druckgröße wird geschätzt.
            </p>
          )}
          {(draftNote || draftStatus !== "idle") && (
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {draftNote ?? (draftStatus === "saved"
                ? "Entwurf automatisch auf diesem Gerät gespeichert."
                : draftStatus === "noImages"
                  ? "Entwurf gespeichert – deine Bilder sind zu groß für den Browser-Speicher und darin nicht enthalten."
                  : "Automatisches Speichern ist in diesem Browser nicht möglich.")}
            </p>
          )}

          {selectedText && !busy && (
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
                  {fonts.map((f) => <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>{f.label}</option>)}
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

          {imageQuality && <ImageQuality {...imageQuality} />}

          <div className="mt-5 rounded-2xl border bg-card p-3 shadow-sm">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ansichten</p>
            <div className="flex flex-wrap gap-2">
              {shownViews.map((v) => {
                const img = ownImage(variant, v);
                const active = view === v;
                return (
                  <button
                    key={v}
                    onClick={() => switchView(v)}
                    disabled={locked}
                    aria-pressed={active}
                    className={
                      "relative h-20 w-20 overflow-hidden rounded-lg border-2 disabled:cursor-wait " +
                      (active ? "border-primary" : "border-transparent hover:border-border")
                    }
                  >
                    {img ? (
                      <img loading="lazy" decoding="async" src={publicUrl(img.storage_path)} alt={VIEW_LABEL[v]} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">kein foto</span>
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
              <DeliveryTime className="mt-2 text-xs" />
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className={"flex h-6 w-6 items-center justify-center rounded-full " + (step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>1</span>
              <span className={step === 1 ? "text-foreground" : "text-muted-foreground"}>design & farbe</span>
              <span className="mx-1 h-px flex-1 bg-border" />
              <span className={"flex h-6 w-6 items-center justify-center rounded-full " + (step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>2</span>
              <span className={step === 2 ? "text-foreground" : "text-muted-foreground"}>größe, menge & freigabe</span>
            </div>

            {step === 1 ? (
              <>
                <div>
                  <p className="mb-2 text-sm font-medium">Farbe: {variant?.colors?.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v: any, i: number) => (
                      <button
                        key={v.id}
                        onClick={() => chooseVariant(i)}
                        disabled={locked}
                        title={v.colors?.name}
                        aria-label={`Farbe ${v.colors?.name ?? i + 1}`}
                        aria-pressed={i === variantIdx}
                        className={"h-8 w-8 rounded-full border-2 disabled:cursor-wait " + (i === variantIdx ? "border-primary ring-2 ring-primary/30" : "border-border")}
                        style={{ backgroundColor: v.hex ?? v.colors?.hex }}
                      />
                    ))}
                  </div>
                  {contrastHint > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1">
                        {contrastHint === 1 ? "Ein Text ist" : `${contrastHint} Texte sind`} auf dieser Farbe schlecht lesbar.
                      </span>
                      <Button type="button" size="sm" variant="outline" className="h-7" onClick={fixTextContrast} disabled={busy}>
                        Textfarbe anpassen
                      </Button>
                    </div>
                  )}
                </div>
                <Button className="w-full" size="lg" onClick={() => setStep(2)} disabled={busy}>
                  weiter zu größe & menge <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <button onClick={() => setStep(1)} disabled={busy} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary disabled:opacity-50">
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
                              disabled={!ok || q <= 0 || busy}
                              onClick={() => setQ(q - 1)}
                              aria-label={`${s.name} weniger`}
                              className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent disabled:opacity-30"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              disabled={!ok || busy}
                              value={q}
                              aria-label={`Menge ${s.name}`}
                              onChange={(e) => setQ(Math.trunc(Number(e.target.value)) || 0)}
                              className="h-8 w-12 rounded-md border border-input bg-background text-center text-sm"
                            />
                            <button
                              disabled={!ok || busy}
                              onClick={() => setQ(q + 1)}
                              aria-label={`${s.name} mehr`}
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
                {review && (
                  <PrintApproval review={review} viewLabel={VIEW_LABEL} approved={approved} onChange={setApproved} disabled={busy} />
                )}
                <Button
                  className="w-full"
                  size="lg"
                  disabled={totalPieces === 0 || busy || viewLoading || (elementCount > 0 && !approved)}
                  onClick={handleAddToCart}
                >
                  {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                  {adding ? "Design wird gespeichert…" : "In den Warenkorb"}
                </Button>
                {addError && <p role="alert" className="text-center text-sm text-destructive">{addError}</p>}
                {totalPieces === 0 && <p className="text-center text-xs text-muted-foreground">Mindestens 1 Stück wählen.</p>}
                {totalPieces > 0 && elementCount > 0 && !approved && !busy && (
                  <p className="text-center text-xs text-muted-foreground">Bitte bestätige die Druckfreigabe.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
