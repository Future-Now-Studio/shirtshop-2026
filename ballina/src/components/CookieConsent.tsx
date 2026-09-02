import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

const KEY = 'ballina_cookie_consent'

export function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true)
    } catch {
      /* ignore */
    }
  }, [])

  function decide(value: 'essential' | 'all') {
    try {
      localStorage.setItem(KEY, value)
    } catch {
      /* ignore */
    }
    setShow(false)
  }

  if (!show) return null
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-xl border border-border bg-background p-4 shadow-xl sm:inset-x-auto sm:right-4">
      <p className="text-sm text-muted-foreground">
        Wir verwenden nur technisch notwendige Cookies, um das Portal bereitzustellen. Details in der{' '}
        <Link to="/datenschutz" className="font-medium text-brand hover:underline">
          Datenschutzerklärung
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="sm" onClick={() => decide('essential')}>
          Nur notwendige
        </Button>
        <Button variant="brand" size="sm" onClick={() => decide('all')}>
          Alle akzeptieren
        </Button>
      </div>
    </div>
  )
}
