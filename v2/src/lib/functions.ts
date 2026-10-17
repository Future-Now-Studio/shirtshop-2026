import { supabase } from "@/lib/supabase";

/**
 * Calls a Supabase Edge Function and returns a readable German error instead
 * of supabase-js' generic "Edge Function returned a non-2xx status code".
 * Our functions answer errors as JSON `{ error: "…" }`.
 */
export async function invokeFn<T = any>(name: string, body: unknown): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error && !(data as any)?.error) return { data: data as T, error: null };
  if ((data as any)?.error) return { data: null, error: String((data as any).error) };
  try {
    const res = (error as any)?.context;
    const json = res && typeof res.json === "function" ? await res.json() : null;
    if (json?.error) return { data: null, error: String(json.error) };
  } catch { /* not JSON */ }
  console.error(name, error);
  return { data: null, error: "Der Server ist gerade nicht erreichbar. Bitte in ein paar Minuten erneut versuchen." };
}
