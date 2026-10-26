import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileText, Printer, X } from 'lucide-react'
import { declineQuote, getCompany, getQuotes } from '@/lib/api'
import { openQuoteDocument } from '@/lib/documents'
import { useOrderFlow } from '@/lib/orderFlow'
import { cn, formatDate, formatEUR, FREE_SHIPPING_FROM, isQuoteAcceptable, shippingFor } from '@/lib/utils'
import { QUOTE_STATUS_LABELS, type Quote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/PageHeader'
import { LoadError, LoadingState } from '@/components/ui/load-state'

const STATUS_VARIANT: Record<Quote['status'], 'info' | 'success' | 'destructive' | 'neutral'> = {
  offen: 'info',
  angenommen: 'success',
  abgelehnt: 'destructive',
  abgelaufen: 'neutral',
}

/** "zzgl. Versand" hint — orders from quotes follow the normal shipping rule. */
function shippingHint(net: number): string {
  const s = shippingFor(net)
  return s === 0
    ? 'versandkostenfrei · zzgl. USt.'
    : `zzgl. ${formatEUR(s)} Versand (frei ab ${formatEUR(FREE_SHIPPING_FROM)}) · zzgl. USt.`
}

export default function Quotes({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const focusId = params.get('angebot')
  const { startOrder } = useOrderFlow()
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: getCompany })
  const { data: quotes = [], isLoading, isError, refetch } = useQuery({ queryKey: ['quotes'], queryFn: getQuotes })

  const decline = useMutation({
    mutationFn: (id: string) => declineQuote(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  })

  // Deep link from "Meine Anfragen" (?angebot=<id>): bring that quote into view.
  useEffect(() => {
    if (!focusId || isLoading) return
    document.getElementById(`angebot-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusId, isLoading])

  function accept(q: Quote) {
    // Binding order → confirmation dialog with PO, delivery address, Wunschtermin and totals.
    startOrder(
      q.items.map(({ productId, productName, imageUrl, color, size, quantity, unitPrice }) => ({
        productId, productName, imageUrl, color, size, quantity, unitPrice,
      })),
      { quote: q },
    )
  }

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Angebote"
          description="Individuelle Angebote auf Ihre Anfragen – prüfen und verbindlich annehmen."
        />
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <LoadError what="Ihre Angebote" onRetry={() => refetch()} />
      ) : quotes.length === 0 ? (
        <Card className="grid place-items-center gap-3 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <FileText className="size-6" />
          </div>
          <p className="font-medium">Noch keine Angebote</p>
          <p className="text-sm text-muted-foreground">
            Stellen Sie eine Anfrage – Ihr Angebot erscheint dann hier.
          </p>
          <Link to="/angebote?tab=anfrage">
            <Button variant="brand">Anfrage stellen</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {quotes.map((q) => {
            const totalQty = q.items.reduce((s, i) => s + i.quantity, 0)
            // Expired quotes are not acceptable even before the DB flags them.
            const open = isQuoteAcceptable(q)
            const status = q.status === 'offen' && !open ? 'abgelaufen' : q.status
            const label = q.withdrawnAt ? 'Zurückgezogen' : QUOTE_STATUS_LABELS[status]
            const busy = decline.isPending
            return (
              <Card
                key={q.id}
                id={`angebot-${q.id}`}
                className={cn('scroll-mt-24 overflow-hidden', focusId === q.id && 'ring-2 ring-brand/40')}
              >
                <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold">{q.title}</span>
                      <Badge variant={STATUS_VARIANT[status]}>{label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {q.quoteNumber} · vom {formatDate(q.createdAt)}
                      {q.validUntil ? ` · gültig bis ${formatDate(q.validUntil)}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tracking-tight">
                      {formatEUR(q.total)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">netto</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{totalQty} Stück · {shippingHint(q.total)}</p>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {q.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                      <span>
                        {it.productName}{' '}
                        <span className="text-muted-foreground">
                          · {it.color} · Größe {it.size}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {it.quantity} × {formatEUR(it.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                {q.note && (
                  <p className="whitespace-pre-line border-t border-border bg-muted/30 px-5 py-3 text-sm text-muted-foreground">
                    {q.note}
                  </p>
                )}

                <div className="flex flex-col gap-2 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-end">
                  <Button variant="ghost" size="sm" className="sm:mr-auto" onClick={() => openQuoteDocument(q, company?.company ?? '')}>
                    <Printer className="size-4" /> Als PDF
                  </Button>
                  {q.status === 'angenommen' && q.orderId && (
                    <Link to={`/bestellung/${q.orderId}`}>
                      <Button variant="outline" size="sm">Zur Bestellung</Button>
                    </Link>
                  )}
                  {open && (
                    <>
                      {decline.error && decline.variables === q.id && (
                        <p className="text-sm text-destructive sm:mr-auto">{(decline.error as Error).message}</p>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => confirm(`Angebot ${q.quoteNumber} wirklich ablehnen?`) && decline.mutate(q.id)}
                        disabled={busy}
                      >
                        <X className="size-4" />
                        Ablehnen
                      </Button>
                      <Button variant="brand" onClick={() => accept(q)} disabled={busy}>
                        <Check className="size-4" />
                        Annehmen &amp; bestellen …
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
