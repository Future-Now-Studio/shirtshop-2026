import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileText, Loader2, X } from 'lucide-react'
import { acceptQuote, declineQuote, getQuotes } from '@/lib/api'
import { formatDate, formatEUR } from '@/lib/utils'
import { QUOTE_STATUS_LABELS, type Quote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/PageHeader'

const STATUS_VARIANT: Record<Quote['status'], 'info' | 'success' | 'destructive' | 'neutral'> = {
  offen: 'info',
  angenommen: 'success',
  abgelehnt: 'destructive',
  abgelaufen: 'neutral',
}

export default function Quotes({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: quotes = [], isLoading } = useQuery({ queryKey: ['quotes'], queryFn: getQuotes })

  const accept = useMutation({
    mutationFn: (id: string) => acceptQuote(id),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      navigate(`/bestellung-erfolg/${order.id}`)
    },
  })
  const decline = useMutation({
    mutationFn: (id: string) => declineQuote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  })

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Angebote"
          description="Individuelle Angebote auf Ihre Großanfragen – mit einem Klick annehmen."
        />
      )}

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : quotes.length === 0 ? (
        <Card className="grid place-items-center gap-3 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <FileText className="size-6" />
          </div>
          <p className="font-medium">Noch keine Angebote</p>
          <p className="text-sm text-muted-foreground">
            Stellen Sie eine Großanfrage – Sie erhalten Ihr Angebot hier.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {quotes.map((q) => {
            const totalQty = q.items.reduce((s, i) => s + i.quantity, 0)
            const open = q.status === 'offen'
            const busy = accept.isPending || decline.isPending
            return (
              <Card key={q.id} className="overflow-hidden">
                <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold">{q.title}</span>
                      <Badge variant={STATUS_VARIANT[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {q.quoteNumber} · vom {formatDate(q.createdAt)} · gültig bis{' '}
                      {formatDate(q.validUntil)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tracking-tight">{formatEUR(q.total)}</p>
                    <p className="text-xs text-muted-foreground">{totalQty} Stück netto</p>
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
                      <span className="text-muted-foreground">
                        {it.quantity} × {formatEUR(it.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                {q.note && (
                  <p className="border-t border-border bg-muted/30 px-5 py-3 text-sm text-muted-foreground">
                    {q.note}
                  </p>
                )}

                {open && (
                  <div className="flex flex-col gap-2 border-t border-border p-5 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => decline.mutate(q.id)}
                      disabled={busy}
                    >
                      <X className="size-4" />
                      Ablehnen
                    </Button>
                    <Button variant="brand" onClick={() => accept.mutate(q.id)} disabled={busy}>
                      {accept.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Angebot annehmen &amp; bestellen
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
