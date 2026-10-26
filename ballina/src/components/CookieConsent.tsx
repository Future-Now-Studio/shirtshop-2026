import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

const KEY = 'ballina_cookie_consent'

/**
 * Information note, not a consent banner: the portal only stores what is
 * technically necessary (login session) and uses no tracking, so there is
 * nothing to accept or decline (§ 25 Abs. 2 Nr. 2 TDDDG). If analytics or
 * marketing tools are ever added, this must become a real consent dialog.
 */
export function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true)
    } catch {
      /* ignore */
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(KEY, 'info')
    } catch {
      /* ignore */
    }
    setShow(false)
  }

  if (!show) return null
  return (
    <div
      role="region"
      aria-label="Hinweis zur Speicherung"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-xl sm:inset-x-auto sm:right-4 sm:flex-row sm:items-center"
    >
      <p className="text-sm text-muted-foreground">
        Dieses Portal speichert nur technisch notwendige Daten in Ihrem Browser (z. B. Ihre
        Anmeldung) – kein Tracking, keine Werbe-Cookies. Details in der{' '}
        <Link to="/datenschutz" className="font-medium text-brand hover:underline">
          Datenschutzerklärung
        </Link>
        .
      </p>
      <Button variant="outline" size="sm" className="shrink-0" onClick={dismiss}>
        Verstanden
      </Button>
    </div>
  )
}
