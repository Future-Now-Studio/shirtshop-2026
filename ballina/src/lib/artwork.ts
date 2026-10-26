import { supabase } from './supabase'

const BUCKET = 'artwork'
export const ARTWORK_ACCEPT = '.pdf,.ai,.eps,.svg,.png,.jpg,.jpeg,.tif,.tiff'
export const ARTWORK_MAX_BYTES = 25 * 1024 * 1024

/** Validates a print file before upload; returns an error text or null. */
export function artworkProblem(file: File): string | null {
  if (file.size > ARTWORK_MAX_BYTES) return 'Die Druckdatei ist größer als 25 MB.'
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ARTWORK_ACCEPT.split(',').includes(`.${ext}`)) return 'Bitte PDF, AI, EPS, SVG, PNG, JPG oder TIF hochladen.'
  return null
}

/**
 * Uploads a customer print file into the company's own folder of the private
 * `artwork` bucket and returns its storage path (RLS: own folder only).
 */
export async function uploadArtwork(companyId: string, file: File): Promise<string> {
  if (!supabase) throw new Error('Upload im Demo-Modus nicht verfügbar.')
  const problem = artworkProblem(file)
  if (problem) throw new Error(problem)
  // Plain file name only ([A-Za-z0-9_.-], no '..'): create_order and the
  // inquiry trigger reject anything else (see 012_customer_flow.sql).
  const safe = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/\.{2,}/g, '.').slice(-80)
  const path = `${companyId}/${crypto.randomUUID()}-${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(`Druckdatei konnte nicht hochgeladen werden: ${error.message}`)
  return path
}

/** Short-lived download link for a stored print file. */
export async function artworkHref(path: string): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600, { download: true })
  return data?.signedUrl ?? null
}
