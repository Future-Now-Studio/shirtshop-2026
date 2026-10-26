// Print-file helpers for the designer: zone geometry, physical size and DPI
// estimates, accepted upload formats and high-resolution PNG exports.
import type * as fabric from "fabric";

/** Edge length of the (square) design canvas in canvas px. */
export const DESIGN_CANVAS_PX = 480;

/**
 * Physical width the design canvas represents when a print zone carries no
 * size in its name. Assumption: product photos show the garment (size L incl.
 * sleeves) filling most of the square, so 480 px ≈ 80 cm and the seeded
 * "Brust groß" zone (40 % of the width) ≈ 32 cm. Exact values come from the
 * zone name, e.g. "Brust groß 30x40 cm" (see sizeFromLabel).
 */
export const DEFAULT_CANVAS_CM = 80;

/** Effective resolution recommended for DTF/DTG; below MIN_OK_DPI it is clearly blurry. */
export const MIN_GOOD_DPI = 150;
export const MIN_OK_DPI = 100;

/** Print file: ~4000 px on the long edge, ≤ 16 MP (iOS canvas limit) and below the 25 MB bucket limit. */
export const PRINT_MAX_EDGE = 4000;
const PRINT_MAX_AREA = 16_000_000;
const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
/** Per-element PNGs: texts stay sharp; images are previews (the original is uploaded too). */
export const TEXT_ELEMENT_MAX_EDGE = 2500;
export const IMAGE_ELEMENT_MAX_EDGE = 1200;

export const PLACEHOLDER_TEXT = "Dein Text";

export interface Box { left: number; top: number; width: number; height: number }
/** A print zone in canvas px plus its physical size (cm). */
export interface Zone extends Box { label: string | null; cmW: number; cmH: number; sized: boolean }

export const isTextType = (t?: string) => /^(textbox|i-?text|text)$/i.test(t ?? "");
export const isImageType = (t?: string) => /^image$/i.test(t ?? "");

const round1 = (n: number) => Math.round(n * 10) / 10;

// --- zones & geometry --------------------------------------------------------

/** Reads a physical size such as "30x40 cm", "30 × 40cm" or "29,7x42 cm" from a zone name. */
export function sizeFromLabel(label?: string | null): { w: number; h: number } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm/i.exec(label ?? "");
  if (!m) return null;
  const w = parseFloat(m[1].replace(",", "."));
  const h = parseFloat(m[2].replace(",", "."));
  return w > 0 && h > 0 ? { w, h } : null;
}

/** DB print zones (fractions 0..1) as canvas boxes with physical size. */
export function toZones(rows: { x: number; y: number; width: number; height: number; label?: string | null }[]): Zone[] {
  const perPx = DEFAULT_CANVAS_CM / DESIGN_CANVAS_PX;
  return rows.map((z) => {
    const box = {
      left: z.x * DESIGN_CANVAS_PX,
      top: z.y * DESIGN_CANVAS_PX,
      width: Math.max(1, z.width * DESIGN_CANVAS_PX),
      height: Math.max(1, z.height * DESIGN_CANVAS_PX),
    };
    const cm = sizeFromLabel(z.label);
    return { ...box, label: z.label ?? null, cmW: cm?.w ?? box.width * perPx, cmH: cm?.h ?? box.height * perPx, sized: !!cm };
  });
}

/** cm per canvas px for content in `zone` (default estimate without a zone). */
export function cmPerPx(zone?: Zone | null) {
  if (!zone) {
    const d = DEFAULT_CANVAS_CM / DESIGN_CANVAS_PX;
    return { x: d, y: d, estimated: true };
  }
  return { x: zone.cmW / zone.width, y: zone.cmH / zone.height, estimated: !zone.sized };
}

const TOLERANCE = 2; // canvas px
export const insideBox = (r: Box, z: Box) =>
  r.left >= z.left - TOLERANCE && r.top >= z.top - TOLERANCE &&
  r.left + r.width <= z.left + z.width + TOLERANCE && r.top + r.height <= z.top + z.height + TOLERANCE;

function overlap(a: Box, b: Box) {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

function union(boxes: Box[]): Box {
  const l = Math.min(...boxes.map((b) => b.left));
  const t = Math.min(...boxes.map((b) => b.top));
  const r = Math.max(...boxes.map((b) => b.left + b.width));
  const btm = Math.max(...boxes.map((b) => b.top + b.height));
  return { left: l, top: t, width: r - l, height: btm - t };
}

function clampToCanvas(b: Box): Box {
  const l = Math.max(0, b.left);
  const t = Math.max(0, b.top);
  const r = Math.min(DESIGN_CANVAS_PX, b.left + b.width);
  const btm = Math.min(DESIGN_CANVAS_PX, b.top + b.height);
  return { left: l, top: t, width: Math.max(1, r - l), height: Math.max(1, btm - t) };
}

/** Zone an element belongs to: the one containing it, else the one it overlaps most. */
export function zoneFor(r: Box, zones: Zone[]): Zone | null {
  const inside = zones.find((z) => insideBox(r, z));
  if (inside) return inside;
  let best: Zone | null = null;
  let bestArea = 0;
  for (const z of zones) {
    const a = overlap(r, z);
    if (a > bestArea) { best = z; bestArea = a; }
  }
  return best;
}

/** Zone whose physical scale applies to an element (its own zone, else the view's first). */
export const scaleZone = (r: Box, zones: Zone[]): Zone | null => zoneFor(r, zones) ?? zones[0] ?? null;

/**
 * Area of the print file for one view: the zone(s) the design touches; the
 * design's bounding box when the view has no zone or nothing touches one.
 * `clipped` = some element sticks out of that area and is cut off.
 */
export function printCrop(elements: Box[], zones: Zone[]): { rect: Box; zone: Zone | null; clipped: boolean } {
  const hits = zones.filter((z) => elements.some((e) => overlap(e, z) > 0));
  if (hits.length) {
    const rect = clampToCanvas(union(hits));
    return { rect, zone: hits[0], clipped: elements.some((e) => !insideBox(e, rect)) };
  }
  return { rect: clampToCanvas(union(elements)), zone: null, clipped: false };
}

/** Axis-aligned bounding box of a serialized fabric object (canvas px, incl. rotation). */
export function jsonBounds(o: any): Box {
  const stroke = o.strokeWidth ?? 0;
  const w = ((o.width ?? 0) + stroke) * Math.abs(o.scaleX ?? 1);
  const h = ((o.height ?? 0) + stroke) * Math.abs(o.scaleY ?? 1);
  const a = ((o.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // left/top is the origin point; fabric rotates around the centre.
  const ox = o.originX === "center" ? 0 : o.originX === "right" ? -w / 2 : w / 2;
  const oy = o.originY === "center" ? 0 : o.originY === "bottom" ? -h / 2 : h / 2;
  const cx = (o.left ?? 0) + ox * cos - oy * sin;
  const cy = (o.top ?? 0) + ox * sin + oy * cos;
  const ex = Math.abs((w / 2) * cos) + Math.abs((h / 2) * sin);
  const ey = Math.abs((w / 2) * sin) + Math.abs((h / 2) * cos);
  return { left: cx - ex, top: cy - ey, width: 2 * ex, height: 2 * ey };
}

// --- print quality -------------------------------------------------------------

/** Effective print resolution of an image object at its current size (source px per inch). */
export function imageDpi(o: { scaleX?: number; scaleY?: number }, scale: { x: number; y: number }): number {
  const cmPerSourcePx = Math.max(Math.abs(o.scaleX ?? 1) * scale.x, Math.abs(o.scaleY ?? 1) * scale.y, 1e-9);
  return Math.round(2.54 / cmPerSourcePx);
}

export type Quality = "good" | "ok" | "low";
export const dpiQuality = (dpi: number): Quality => (dpi >= MIN_GOOD_DPI ? "good" : dpi >= MIN_OK_DPI ? "ok" : "low");

export interface ReviewIssue { view: string; kind: "zone" | "dpi" | "placeholder"; message: string }
export interface DesignReview { texts: { view: string; text: string }[]; issues: ReviewIssue[] }

/** Collects what the customer should check before approving the print (all views). */
export function reviewDesign(
  views: Record<string, any>,
  zonesOf: (view: string) => Zone[],
  isVector: (src: string) => boolean,
  viewLabel: Record<string, string>,
): DesignReview {
  const texts: DesignReview["texts"] = [];
  const issues: ReviewIssue[] = [];
  for (const [view, json] of Object.entries(views)) {
    const zones = zonesOf(view);
    const label = viewLabel[view] ?? view;
    let outside = false;
    for (const o of (json?.objects ?? []) as any[]) {
      if (o.__zone) continue;
      const box = jsonBounds(o);
      if (zones.length && !zones.some((z) => insideBox(box, z))) outside = true;
      if (isTextType(o.type)) {
        const text = String(o.text ?? "").trim();
        if (!text) continue;
        texts.push({ view, text });
        if (text === PLACEHOLDER_TEXT) {
          issues.push({ view, kind: "placeholder", message: `${label}: Der Platzhalter „${PLACEHOLDER_TEXT}“ wird so gedruckt.` });
        }
      } else if (isImageType(o.type) && !isVector(o.src)) {
        const dpi = imageDpi(o, cmPerPx(scaleZone(box, zones)));
        const q = dpiQuality(dpi);
        if (q !== "good") {
          issues.push({
            view,
            kind: "dpi",
            message: `${label}: Ein Bild hat bei dieser Größe nur ca. ${dpi} dpi und wird ${q === "low" ? "deutlich unscharf" : "evtl. leicht unscharf"} gedruckt (empfohlen: mind. ${MIN_GOOD_DPI} dpi).`,
          });
        }
      }
    }
    if (outside) {
      issues.push({ view, kind: "zone", message: `${label}: Ein Motiv ragt über die Druckzone hinaus – dieser Teil wird nicht gedruckt.` });
    }
  }
  return { texts, issues };
}

/** Billable design elements (contract: all objects without __zone, across all views). */
export function countDesignElements(views: Record<string, any>): number {
  return Object.values(views).reduce((n: number, v: any) => n + ((v?.objects ?? []) as any[]).filter((o) => !o.__zone).length, 0);
}

// --- uploads -----------------------------------------------------------------

/** Upload formats the designer can place and the order-designs bucket accepts. */
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
const EXT_TYPES: Record<string, string> = { png: "png", jpg: "jpeg", jpeg: "jpeg", webp: "webp", svg: "svg+xml" };
export const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml";
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 50_000_000;

const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/** Normalised MIME type of an accepted image file (null = not supported). */
export function imageMime(file: File): string | null {
  const t = file.type.toLowerCase();
  if (IMAGE_TYPES[t]) return t;
  const ext = EXT_TYPES[extOf(file.name)];
  return ext ? `image/${ext}` : null;
}

/** File extension for an uploaded original. */
export const originalExt = (mime: string) => IMAGE_TYPES[mime] ?? "png";

/** German error for files the designer cannot place (null = fine). */
export function imageFileProblem(file: File): string | null {
  const t = file.type.toLowerCase();
  const ext = extOf(file.name);
  if (t === "application/pdf" || ext === "pdf") {
    return "PDF-Dateien können im Designer nicht platziert werden. Bitte exportiere dein Motiv als PNG, JPG oder SVG.";
  }
  if (/hei[cf]/.test(t) || ext === "heic" || ext === "heif") {
    return "iPhone-Fotos im HEIC-Format werden nicht unterstützt. Bitte speichere das Foto als JPG oder PNG und lade es erneut hoch.";
  }
  if (!imageMime(file)) return "Dieses Dateiformat wird nicht unterstützt. Bitte PNG, JPG, WebP oder SVG verwenden.";
  if (file.size === 0) return "Die Datei ist leer.";
  if (file.size > MAX_IMAGE_BYTES) return "Das Bild ist größer als 15 MB.";
  return null;
}

// --- high-resolution export ----------------------------------------------------

function toBlob(el: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try { el.toBlob((b) => resolve(b), "image/png"); } catch { resolve(null); }
  });
}

/** Text caches are capped at ~2 MP by fabric; render uncached so big exports stay sharp. */
function uncached<T>(objs: fabric.FabricObject[], fn: () => T): T {
  const prev = objs.map((o) => o.objectCaching);
  objs.forEach((o) => { o.objectCaching = false; });
  try { return fn(); } finally { objs.forEach((o, i) => { o.objectCaching = prev[i]; }); }
}

// fabric's toCanvasElement only restores the canvas/object state when drawing
// succeeds; a device that can't allocate the bitmap would leave the live
// design shifted or zoomed. Restore it ourselves before retrying smaller.
function canvasElement(c: fabric.StaticCanvas, m: number, rect: Box): HTMLCanvasElement {
  const s: any = c;
  const saved = { vp: [...c.viewportTransform] as fabric.TMat2D, w: c.width, h: c.height, retina: c.enableRetinaScaling, skip: s.skipControlsDrawing };
  try {
    return c.toCanvasElement(m, { ...rect, filter: (o: any) => !o.__zone });
  } catch (e) {
    c.viewportTransform = saved.vp;
    c.width = saved.w;
    c.height = saved.h;
    c.enableRetinaScaling = saved.retina;
    s.skipControlsDrawing = saved.skip;
    c.calcViewportBoundaries();
    throw e;
  }
}

function objectElement(o: fabric.FabricObject, m: number): HTMLCanvasElement {
  const s: any = o;
  const saved = { left: o.left, top: o.top, canvas: s.canvas, group: o.group };
  try {
    return o.toCanvasElement({ multiplier: m });
  } catch (e) {
    s.canvas = saved.canvas;
    if (saved.group) o.group = saved.group;
    o.set({ left: saved.left, top: saved.top });
    o.setCoords();
    throw e;
  }
}

export interface RenderedPng { blob: Blob; multiplier: number; pxW: number; pxH: number }

/** Renders at the largest multiplier within the limits, stepping down until the PNG fits the bucket. */
async function fitPng(render: (m: number) => HTMLCanvasElement, w: number, h: number, maxEdge: number, maxMultiplier = Infinity): Promise<RenderedPng> {
  let m = Math.min(maxMultiplier, maxEdge / Math.max(w, h, 1), Math.sqrt(PRINT_MAX_AREA / Math.max(w * h, 1)));
  for (let attempt = 0; attempt < 5; attempt++) {
    let el: HTMLCanvasElement | null = null;
    try { el = render(m); } catch { /* canvas too large for this device: try smaller */ }
    const pxW = el?.width ?? 0;
    const pxH = el?.height ?? 0;
    const blob = el && pxW && pxH ? await toBlob(el) : null;
    if (el) {
      el.width = 0; // free the bitmap right away (iOS keeps canvas memory otherwise)
      el.height = 0;
    }
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return { blob, multiplier: m, pxW, pxH };
    m *= 0.7;
  }
  throw new Error("Druckdatei konnte nicht erzeugt werden (zu groß).");
}

/**
 * Print file for the current canvas: crop `rect`, transparent background, no
 * guides, ~4000 px on the long edge.
 */
export async function renderPrintPng(c: fabric.StaticCanvas, rect: Box): Promise<RenderedPng> {
  const objs = c.getObjects().filter((o: any) => !o.__zone);
  const bgImage = c.backgroundImage;
  const bgColor = c.backgroundColor;
  c.backgroundImage = undefined;
  c.backgroundColor = "";
  try {
    return await fitPng((m) => uncached(objs, () => canvasElement(c, m, rect)), rect.width, rect.height, PRINT_MAX_EDGE);
  } finally {
    c.backgroundImage = bgImage;
    c.backgroundColor = bgColor;
  }
}

/** One element as its own transparent PNG (at most the print file's resolution). */
export function renderElementPng(o: fabric.FabricObject, maxEdge: number, maxMultiplier: number): Promise<RenderedPng> {
  const r = o.getBoundingRect();
  return fitPng((m) => uncached([o], () => objectElement(o, m)), r.width, r.height, maxEdge, maxMultiplier);
}

/** Per-view print info for design.json and the manifest (sizes are estimates unless the zone name has cm). */
export function printInfo(file: string, crop: { rect: Box; zone: Zone | null; clipped: boolean }, png: RenderedPng) {
  const scale = cmPerPx(crop.zone);
  const cmW = round1(crop.rect.width * scale.x);
  const cmH = round1(crop.rect.height * scale.y);
  return {
    file,
    zone: crop.zone?.label ?? null,
    clipped: crop.clipped,
    canvasPx: DESIGN_CANVAS_PX,
    crop: { left: Math.round(crop.rect.left), top: Math.round(crop.rect.top), width: Math.round(crop.rect.width), height: Math.round(crop.rect.height) },
    px: { w: png.pxW, h: png.pxH },
    cm: { w: cmW, h: cmH },
    dpi: cmW > 0 ? Math.round(png.pxW / (cmW / 2.54)) : null,
    sizeEstimated: scale.estimated,
  };
}

/** Element position/size in cm relative to the top-left corner of the print file. */
export function elementCm(r: Box, crop: { rect: Box; zone: Zone | null }) {
  const s = cmPerPx(crop.zone);
  return {
    left: round1((r.left - crop.rect.left) * s.x),
    top: round1((r.top - crop.rect.top) * s.y),
    width: round1(r.width * s.x),
    height: round1(r.height * s.y),
  };
}
