import { supabase } from "@/lib/supabase";

const BUCKET = "product-images";

// Deterministic path so re-uploading a view overwrites the old image.
export function variantImagePath(productId: string, variantId: string, view: string, ext: string) {
  return `${productId}/${variantId}/${view}.${ext}`;
}

export async function uploadVariantImage(
  productId: string,
  variantId: string,
  view: string,
  file: File
): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = variantImagePath(productId, variantId, view, ext);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (error) throw error;
  return path;
}

export function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removeImage(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}
