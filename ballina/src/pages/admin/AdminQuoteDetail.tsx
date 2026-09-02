import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileDown, Loader2 } from 'lucide-react'
import { adminGetQuote } from '@/lib/adminApi'
import { formatDate, formatEUR } from '@/lib/utils'
import { openQuoteDocument } from '@/lib/documents'
import { QUOTE_STATUS_LABELS, type Quote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const VARIANT: Record<Quote['status'], 'info' | 'success' | 'destructive' | 'neutral'> = {
  offen: 'info',
  angenommen: 'success',
  abgelehnt: 'destructive',
  abgelaufen: 'neutral',
}

export default function AdminQuoteDetail() {
  const { id = '' } = useParams()
  const { data: quote, isLoading } = useQuery({
    queryKey: ['admin', 'quote', id],
    queryFn: () => adminGetQuote(id),
  })

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!quote) {
    return (
      <Card className="grid place-items-center gap-3 py-16 text-center">
        <p className="font-medium">Angebot nicht gefunden</p>
        <Link to="/admin/angebote">
          <Button variant="outline">Zurück</Button>
        </Link>
      </Card>
    )
  }

  return (
    <div>
      <Link to="/admin/angebote" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Alle Angebote
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{quote.title}</h1>
            <Badge variant={VARIANT[quote.status]}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {quote.quoteNumber} · {quote.companyName} · vom {formatDate(quote.createdAt)} · gültig bis{' '}
            {formatDate(quote.validUntil)}
          </p>
        </div>
        <Button variant="outline" size="lg" onClick={() => openQuoteDocument(quote, quote.companyName)}>
          <FileDown className="size-4" />
          Angebot (PDF)
        </Button>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Artikel</span>
          <span className="w-20 text-right">Menge</span>
          <span className="w-24 text-right">Einzelpreis</span>
          <span className="w-24 text-right">Summe</span>
        </div>
        <div className="divide-y divide-border">
          {quote.items.map((it) => (
            <div key={it.id} className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4">
              <div>
                <p className="font-medium">{it.productName}</p>
                <p className="text-sm text-muted-foreground">
                  {it.color}
                  {it.size ? ` · Größe ${it.size}` : ''}
                </p>
              </div>
              <div className="text-sm sm:w-20 sm:text-right">{it.quantity}</div>
              <div className="text-sm sm:w-24 sm:text-right">{formatEUR(it.unitPrice)}</div>
              <div className="font-medium sm:w-24 sm:text-right">{formatEUR(it.unitPrice * it.quantity)}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t border-border bg-muted/30 px-5 py-4">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span>Angebotssumme (netto)</span>
              <span>{formatEUR(quote.total)}</span>
            </div>
          </div>
        </div>
      </Card>

      {quote.note && (
        <Card className="mt-4 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hinweis</p>
          <p className="mt-1.5 text-sm">{quote.note}</p>
        </Card>
      )}
    </div>
  )
}
