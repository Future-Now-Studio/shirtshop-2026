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
        const url = await artworkHref(path).catch(() => null)
        setBusy(false)
        // The signed URL is a download (Content-Disposition: attachment): the
        // browser saves the file and the page stays. No new tab, so neither a
        // popup blocker (Safari) nor an empty leftover tab gets in the way.
        if (url) window.location.assign(url)
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
