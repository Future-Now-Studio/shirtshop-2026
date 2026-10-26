// Catalogue helpers shared by the admin pages: slugs, product image
// handling, delete/duplicate and manual ordering.
import { supabase } from "@/lib/supabase";

const BUCKET = "product-images";

/** URL slug with German transliteration: "T-Shirt Männer Größe" → "t-shirt-maenner-groesse". */
export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Product images
// ---------------------------------------------------------------------------

const MAX_BYTES = 5 * 1024 * 1024; // bucket limit (migration 99940000000000_admin_catalog.sql)
const MAX_EDGE = 2400;
const WEB_TYPES = ["image/png", "image/jpeg", "image/webp"];

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Checks a product photo and shrinks it when needed: PNG/JPG/WebP up to
 * 5 MB and 2400 px pass unchanged, anything bigger (or another raster
 * format) is re-encoded in the browser. SVG is refused.
 */
export async function prepareProductImage(file: File): Promise<File> {
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
    throw new Error("SVG ist als Produktbild nicht erlaubt. Bitte PNG, JPG oder WebP hochladen.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Bild konnte nicht gelesen werden. Bitte PNG, JPG oder WebP hochladen.");
  }
  try {
    const { width, height } = bitmap;
    let scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    if (WEB_TYPES.includes(file.type) && file.size <= MAX_BYTES && scale === 1) return file;
    const keepAlpha = file.type !== "image/jpeg";
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      // WebP keeps transparency; browsers without WebP encoding fall back.
      let blob = await toBlob(canvas, "image/webp", 0.85);
      if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, keepAlpha ? "image/png" : "image/jpeg", 0.85);
      if (blob && blob.size <= MAX_BYTES) {
        const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
        return new File([blob], file.name.replace(/\.[^.]*$/, "") + "." + ext, { type: blob.type });
      }
      scale *= 0.75;
    }
    throw new Error("Bild ist zu groß (max. 5 MB). Bitte verkleinern und erneut hochladen.");
  } finally {
    bitmap.close();
  }
}

/** All files below a folder of the product-images bucket (<product>/<variant>/<view>.<ext>). */
async function listFiles(prefix: string, depth = 0): Promise<string[]> {
  const { data } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  const out: string[] = [];
  for (const e of data ?? []) {
    const path = `${prefix}/${e.name}`;
    if (e.id) out.push(path);
    else if (depth < 2) out.push(...(await listFiles(path, depth + 1)));
  }
  return out;
}

/** Deletes those files that no variant_images row references (files can be shared). */
export async function removeUnreferencedImages(paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return;
  const { data, error } = await supabase.from("variant_images").select("storage_path").in("storage_path", unique);
  if (error) return; // keep the files when unsure
  const used = new Set((data ?? []).map((r) => r.storage_path));
  const orphans = unique.filter((p) => !used.has(p));
  if (orphans.length) await supabase.storage.from(BUCKET).remove(orphans);
}

// ---------------------------------------------------------------------------
// Delete / duplicate
// ---------------------------------------------------------------------------

/** Number of order lines that reference a product or colour variant. */
export async function orderLineCount(column: "product_id" | "variant_id", id: string): Promise<number> {
  const { count, error } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq(column, id);
  if (error) throw error;
  return count ?? 0;
}

/** Deletes a never-ordered product incl. variants, sizes, zones and its image files. */
export async function deleteProduct(productId: string) {
  const files = await listFiles(productId);
  const { data, error } = await supabase.from("products").delete().eq("id", productId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Produkt konnte nicht gelöscht werden.");
  await removeUnreferencedImages(files);
}

/** Deletes a never-ordered colour variant and its image files. */
export async function deleteVariant(productId: string, variantId: string) {
  const [files, { data: rows }] = await Promise.all([
    listFiles(`${productId}/${variantId}`),
    supabase.from("variant_images").select("storage_path").eq("variant_id", variantId),
  ]);
  const { data, error } = await supabase.from("variants").delete().eq("id", variantId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Variante konnte nicht gelöscht werden.");
  await removeUnreferencedImages([...files, ...(rows ?? []).map((r) => r.storage_path)]);
}

/**
 * Copies a product as a draft (DB part via duplicate_product(), see migration
 * 99940000000000_admin_catalog.sql) and then its variant images. Returns the
 * new id and how many images could not be copied.
 */
export async function duplicateProduct(productId: string, name: string): Promise<{ id: string; failedImages: number }> {
  const { data, error } = await supabase.rpc("duplicate_product", { p_id: productId, p_name: name });
  if (error) throw error;
  const res = data as unknown as { id: string; variants: { from: string; to: string }[] };
  const target = new Map(res.variants.map((m) => [m.from, m.to]));
  if (!target.size) return { id: res.id, failedImages: 0 };

  const { data: images, error: imgErr } = await supabase
    .from("variant_images")
    .select("variant_id, view, storage_path, sort_order")
    .in("variant_id", [...target.keys()]);
  if (imgErr) return { id: res.id, failedImages: -1 };

  let failed = 0;
  for (const img of images ?? []) {
    const variantId = target.get(img.variant_id)!;
    const ext = /\.([a-z0-9]+)$/i.exec(img.storage_path)?.[1]?.toLowerCase() ?? "png";
    const path = `${res.id}/${variantId}/${img.view}.${ext}`;
    const { error: cpErr } = await supabase.storage.from(BUCKET).copy(img.storage_path, path);
    if (cpErr) { failed++; continue; }
    const { error: rowErr } = await supabase
      .from("variant_images")
      .insert({ variant_id: variantId, view: img.view, storage_path: path, sort_order: img.sort_order });
    if (rowErr) failed++;
  }
  return { id: res.id, failedImages: failed };
}

// ---------------------------------------------------------------------------
// Manual ordering (colours, sizes, variants)
// ---------------------------------------------------------------------------

/** The list with item `index` moved one step up (-1) or down (+1). */
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const j = index + delta;
  if (j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

/** Stores the list order as sort_order 1..n (only rows whose number changes). */
export async function saveOrder(table: "colors" | "sizes" | "variants", items: { id: string; sort_order: number }[]) {
  const results = await Promise.all(
    items.map((it, i) =>
      it.sort_order === i + 1 ? null : supabase.from(table as "colors").update({ sort_order: i + 1 }).eq("id", it.id)
    )
  );
  const failed = results.find((r) => r?.error);
  if (failed?.error) throw failed.error;
}
