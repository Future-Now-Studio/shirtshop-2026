import { supabase } from "@/lib/supabase";

const BUCKET = "order-designs";

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Upload one design file (dataURL) under a design folder. Returns its path.
export async function uploadDesignFile(designId: string, name: string, dataUrl: string): Promise<string | null> {
  const path = `${designId}/${name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, dataUrlToBlob(dataUrl), {
    contentType: "image/png",
    upsert: true,
  });
  return error ? null : path;
}

export async function uploadDesignJson(designId: string, json: unknown): Promise<string | null> {
  const path = `${designId}/design.json`;
  const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "application/json",
    upsert: true,
  });
  return error ? null : path;
}
