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

// Every design gets a fresh random designId, so files are only ever created,
// never overwritten. upsert must stay false: anon may INSERT into the bucket
// but not UPDATE (that would let anyone replace another customer's print file),
// and an upsert needs UPDATE rights — it would be rejected by RLS.
async function upload(path: string, body: Blob, contentType: string): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(`Upload fehlgeschlagen (${path}): ${error.message}`);
  return path;
}

/** Uploads one design file (dataURL) under the design folder. Throws on failure. */
export function uploadDesignFile(designId: string, name: string, dataUrl: string): Promise<string> {
  return upload(`${designId}/${name}`, dataUrlToBlob(dataUrl), "image/png");
}

export function uploadDesignJson(designId: string, json: unknown): Promise<string> {
  return upload(`${designId}/design.json`, new Blob([JSON.stringify(json)], { type: "application/json" }), "application/json");
}
