import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import Quotes from '@/pages/Quotes'
import Inquiry from '@/pages/Inquiry'

type Tab = 'angebote' | 'anfrage'

/** Combined "Angebote & Anfragen" area — the two customer touchpoints for quotes. */
export default function Angebote() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'anfrage' ? 'anfrage' : 'angebote')

  return (
    <div>
      <PageHeader
        title="Angebote & Anfragen"
        description="Erhaltene Angebote annehmen oder eine neue Großanfrage stellen."
      />

      <div className="mb-6 inline-flex rounded-lg border border-border bg-muted/40 p-1">
        {(
          [
            ['angebote', 'Angebote'],
            ['anfrage', 'Neue Anfrage'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'angebote' ? <Quotes embedded /> : <Inquiry embedded />}
    </div>
  )
}
