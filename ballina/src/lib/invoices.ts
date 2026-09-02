import { supabase } from './supabase'

const BUCKET = 'invoices'

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',')
  const mime = /data:(.*?);/.exec(meta)?.[1] ?? 'application/pdf'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/**
 * Store an invoice PDF. In real mode it goes to the private Supabase Storage
 * bucket and the storage PATH is returned; in mock mode the data URL is kept.
 */
export async function uploadInvoice(companyId: string, orderId: string, dataUrl: string): Promise<string> {
  if (!supabase) return dataUrl
  const path = `${companyId}/${orderId}.pdf`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, dataUrlToBlob(dataUrl), { upsert: true, contentType: 'application/pdf' })
  if (error) throw error
  return path
}

/** Resolve a stored invoice reference to a downloadable href (data URL or signed URL). */
export async function invoiceHref(value: string): Promise<string> {
  if (value.startsWith('data:')) return value
  if (!supabase) return value
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(value, 3600)
  if (error) throw error
  return data.signedUrl
}
