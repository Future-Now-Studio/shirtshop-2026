import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { artworkHref } from '@/lib/artwork'

/** Download button for a customer print file (fresh signed URL per click). */
export function ArtworkLink({ path, name }: { path: string; name?: string }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true)
        setFailed(false)
        const url = await artworkHref(path)
        setBusy(false)
        if (url) window.open(url, '_blank', 'noopener')
        else setFailed(true)
      }}
      className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {name ?? 'Druckdatei'}
      {failed && <span className="text-destructive"> (nicht verfügbar)</span>}
    </button>
  )
}
