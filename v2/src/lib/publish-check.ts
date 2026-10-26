import { supabase } from "@/lib/supabase";

/**
 * Why a product cannot be published yet (null = ready). A published product
 * without colour, image, size, stock or print zone shows up broken in the shop
 * (every product can be personalised in the designer, which needs a zone).
 */
export async function publishProblem(productId: string): Promise<string | null> {
  const [{ data: variants, error: vErr }, { data: sizes, error: sErr }, { data: stock, error: aErr }, { count: zones, error: zErr }] = await Promise.all([
    supabase.from("variants").select("id, colors(name), variant_images(view)").eq("product_id", productId),
    supabase.from("product_sizes").select("size_id").eq("product_id", productId),
    supabase.from("variant_size_availability").select("variant_id, available, stock, variants!inner(product_id)").eq("variants.product_id", productId),
    supabase.from("print_zones").select("id", { count: "exact", head: true }).eq("product_id", productId),
  ]);
  if (vErr || sErr || aErr || zErr) return "Prüfung fehlgeschlagen — bitte erneut versuchen.";
  if (!variants?.length) return "Mindestens eine Farbe (Variante) anlegen.";
  const noImage = variants.filter((v: any) => !(v.variant_images ?? []).some((i: any) => i.view === "front"));
  if (noImage.length) return `Vorderansicht-Bild fehlt bei: ${noImage.map((v: any) => v.colors?.name ?? "Variante").join(", ")}.`;
  if (!sizes?.length) return "Mindestens eine Größe aktivieren.";
  if (!(stock ?? []).some((a: any) => a.available && a.stock > 0)) return "Für mindestens eine Farbe/Größe Bestand eintragen.";
  if (!zones) return "Mindestens eine Druckzone anlegen (Tab „Druckzonen“, z. B. auf der Vorderansicht).";
  return null;
}
