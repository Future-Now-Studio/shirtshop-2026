import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Copy, Loader2, Pencil, Printer, RefreshCw, Undo2 } from 'lucide-react'
import { openQuoteDocument } from '@/lib/documents'
import { adminGetQuote, adminWithdrawQuote } from '@/lib/adminApi'
import { formatDate, formatEUR } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatQty, QUOTE_VARIANT, quoteStatusLabel } from './adminFormat'

export default function AdminQuoteDetail() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { data: quote, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'quote', id],
    queryFn: () => adminGetQuote(id),
  })

  const withdraw = useMutation({
    mutationFn: () => adminWithdrawQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'quote', id] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'quotes'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (isError) {
    return (
      <Card className="grid place-items-center gap-3 py-16 text-center">
        <p className="font-medium text-destructive">
          Angebot konnte nicht geladen werden: {(error as Error)?.message ?? 'Unbekannter Fehler'}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="size-4" /> Erneut versuchen
        </Button>
      </Card>
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

  const open = quote.status === 'offen'

  return (
    <div>
      <Link to="/admin/angebote" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Alle Angebote
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{quote.title}</h1>
            <Badge variant={QUOTE_VARIANT[quote.status]}>{quoteStatusLabel(quote)}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {quote.quoteNumber} ·{' '}
            <Link to={`/admin/kunde/${quote.companyId}`} className="hover:text-foreground hover:underline">
              {quote.companyName}
            </Link>{' '}
            · vom {formatDate(quote.createdAt)}
            {quote.validUntil ? ` · gültig bis ${formatDate(quote.validUntil)}` : ''}
            {quote.withdrawnAt ? ` · zurückgezogen am ${formatDate(quote.withdrawnAt)}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {quote.orderId && (
            <Link to={`/admin/bestellung/${quote.orderId}`}>
              <Button variant="outline" size="sm">Zur Bestellung</Button>
            </Link>
          )}
          {open && (
            <Link to={`/admin/angebot/${quote.id}/bearbeiten`}>
              <Button variant="outline" size="sm">
                <Pencil className="size-4" /> Bearbeiten
              </Button>
            </Link>
          )}
          <Link to={`/admin/angebote/neu?vorlage=${quote.id}`}>
            <Button variant="outline" size="sm">
              <Copy className="size-4" /> Als Vorlage kopieren
            </Button>
          </Link>
          {open && (
            <Button
              variant="destructive"
              size="sm"
              disabled={withdraw.isPending}
              onClick={() => {
                if (window.confirm(`Angebot ${quote.quoteNumber} zurückziehen? Der Kunde kann es danach nicht mehr annehmen.`)) {
                  withdraw.mutate()
                }
              }}
            >
              {withdraw.isPending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
              Zurückziehen
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => openQuoteDocument(quote, quote.companyName)}>
            <Printer className="size-4" /> Als PDF / Drucken
          </Button>
        </div>
      </div>
      {withdraw.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Nicht zurückgezogen: {(withdraw.error as Error).message}
        </p>
      )}
      {!open && !quote.orderId && (
        <p className="mt-3 text-sm text-muted-foreground">
          Dieses Angebot ist abgeschlossen. Für eine neue Version „Als Vorlage kopieren“ – der Kunde erhält
          dann ein neues Angebot per E-Mail.
        </p>
      )}

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
              <div className="text-sm sm:w-20 sm:text-right">{formatQty(it.quantity)}</div>
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
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hinweis (für den Kunden sichtbar)</p>
          <p className="mt-1.5 whitespace-pre-line text-sm">{quote.note}</p>
        </Card>
      )}
    </div>
  )
}
