import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from './button'
import { Card } from './card'

/** Centered spinner while a list or page loads. */
export function LoadingState() {
  return (
    <div className="grid place-items-center py-16" role="status" aria-label="Wird geladen">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

/** Shown instead of an empty state when a request failed (network, expired session, …). */
export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <Card role="alert" className="grid place-items-center gap-3 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <div>
        <p className="font-medium">{what} konnten nicht geladen werden</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut. Besteht das Problem weiter,
          melden Sie sich bitte ab und wieder an.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="size-4" /> Erneut versuchen
      </Button>
    </Card>
  )
}
