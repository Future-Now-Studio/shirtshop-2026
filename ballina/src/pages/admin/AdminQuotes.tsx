import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Search } from 'lucide-react'
import { adminGetQuotesPage, adminGetQuoteStatusCounts, type QuoteFilter } from '@/lib/adminApi'
import { useDebounced } from '@/lib/useDebounced'
import { cn, formatDate, formatEUR } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import { QUOTE_VARIANT, quoteStatusLabel } from './adminFormat'

const FILTERS: { key: QuoteFilter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'offen', label: 'Offen' },
  { key: 'angenommen', label: 'Angenommen' },
  { key: 'abgelehnt', label: 'Abgelehnt' },
  { key: 'abgelaufen', label: 'Abgelaufen / zurückgezogen' },
]
const FILTER_KEYS = FILTERS.map((f) => f.key)

export default function AdminQuotes() {
  const [params, setParams] = useSearchParams()
  const rawFilter = params.get('filter') as QuoteFilter | null
  const filter: QuoteFilter = rawFilter && FILTER_KEYS.includes(rawFilter) ? rawFilter : 'alle'
  function setFilter(f: QuoteFilter) {
    const next = new URLSearchParams(params)
    if (f === 'alle') next.delete('filter')
    else next.set('filter', f)
    setParams(next, { replace: true })
  }
  const [q, setQ] = useState('')
  const search = useDebounced(q.trim(), 300)

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin', 'quotes', 'list', filter, search],
    queryFn: ({ pageParam }) => adminGetQuotesPage(filter, search, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.reduce((n, p) => n + p.rows.length, 0) : undefined,
    placeholderData: keepPreviousData,
  })
  const { data: counts } = useQuery({ queryKey: ['admin', 'quotes', 'counts'], queryFn: adminGetQuoteStatusCounts })
  const quotes = data?.pages.flatMap((p) => p.rows) ?? []
  const total = data?.pages[0]?.total

  return (
    <div>
      <PageHeader
        title="Angebote"
        description="Erstellte Angebote und ihr Status."
        action={
          <Link to="/admin/angebote/neu">
            <Button variant="brand" size="lg">
              <Plus className="size-4" />
              Neues Angebot
            </Button>
          </Link>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Angebotsnr., Titel, Firma oder Kd-Nr. suchen…"
          aria-label="Angebote durchsuchen"
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              filter === f.key
                ? 'border-brand bg-brand-muted text-brand'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {f.label}
            {f.key !== 'alle' && counts && <span className="ml-1 text-xs">({counts[f.key]})</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="rounded-xl border border-dashed border-destructive/40 py-12 text-center text-sm text-destructive">
          Angebote konnten nicht geladen werden: {(error as Error)?.message ?? 'Unbekannter Fehler'}
        </p>
      ) : (
        <div className="space-y-3">
          {quotes.map((qu) => (
            <Link key={qu.id} to={`/admin/angebot/${qu.id}`} className="block">
              <Card className="p-5 transition-colors hover:border-brand/40">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold">{qu.title}</span>
                      <Badge variant={QUOTE_VARIANT[qu.status]}>{quoteStatusLabel(qu)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {qu.quoteNumber} · {qu.companyName} · vom {formatDate(qu.createdAt)}
                      {qu.validUntil ? ` · gültig bis ${formatDate(qu.validUntil)}` : ''} · {qu.itemCount}{' '}
                      {qu.itemCount === 1 ? 'Position' : 'Positionen'}
                    </p>
                  </div>
                  <span className="text-lg font-semibold tracking-tight">{formatEUR(qu.total)}</span>
                </div>
              </Card>
            </Link>
          ))}
          {quotes.length === 0 && (
            <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              {search
                ? `Keine Angebote gefunden für „${search}“.`
                : filter === 'alle'
                  ? 'Noch keine Angebote. Erstellen Sie eines aus einer Anfrage oder neu.'
                  : `Keine Angebote mit Status „${FILTERS.find((f) => f.key === filter)?.label}“.`}
            </p>
          )}
          {quotes.length > 0 && (
            <div className="flex items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
              <span>
                {quotes.length}
                {total != null ? ` von ${total}` : ''} Angebote · Beträge netto
              </span>
              {hasNextPage && (
                <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                  Mehr laden
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
