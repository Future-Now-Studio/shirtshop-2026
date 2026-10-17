import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Search } from 'lucide-react'
import { adminGetOrdersPage, adminGetOrderStatusCounts, type OrderFilter } from '@/lib/adminApi'
import { useDebounced } from '@/lib/useDebounced'
import { cn, formatDate, formatEUR } from '@/lib/utils'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'offen', label: 'Offen' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung' },
  { key: 'versendet', label: 'Versendet' },
  { key: 'abgeschlossen', label: 'Abgeschlossen' },
  { key: 'storniert', label: 'Storniert' },
]

export default function AdminOrders() {
  const [filter, setFilter] = useState<OrderFilter>('alle')
  const [q, setQ] = useState('')
  const search = useDebounced(q.trim(), 300)
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin', 'orders', 'list', filter, search],
    queryFn: ({ pageParam }) => adminGetOrdersPage(filter, search, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.reduce((n, p) => n + p.rows.length, 0) : undefined,
    placeholderData: keepPreviousData,
  })
  const { data: counts } = useQuery({ queryKey: ['admin', 'orders', 'counts'], queryFn: adminGetOrderStatusCounts })
  const shown = data?.pages.flatMap((p) => p.rows) ?? []
  const total = data?.pages[0]?.total

  return (
    <div>
      <PageHeader
        title="Bestellungen"
        description="Alle Kundenbestellungen – Status und Versand pflegen."
        action={
          <Link to="/admin/bestellungen/neu">
            <Button variant="brand" size="lg">
              <Plus className="size-4" />
              Neue Bestellung
            </Button>
          </Link>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Bestellnummer oder Firma suchen…"
          aria-label="Bestellungen durchsuchen"
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
            {f.key !== 'alle' && counts && (
              <span className="ml-1 text-xs">({counts[f.key]})</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="rounded-xl border border-dashed border-destructive/40 py-12 text-center text-sm text-destructive">
          Bestellungen konnten nicht geladen werden: {(error as Error)?.message ?? 'Unbekannter Fehler'}
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold">#{o.orderNumber}</span>
                    <StatusBadge status={o.status} />
                    <span className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{o.companyName}</span>
                    <span className="text-muted-foreground">
                      {' '}· {o.itemCount} {o.itemCount === 1 ? 'Position' : 'Positionen'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-semibold tracking-tight">{formatEUR(o.total)}</span>
                  <Link to={`/admin/bestellung/${o.id}`}>
                    <Button variant="outline" size="sm">
                      Bearbeiten
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
          {shown.length === 0 && (
            <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              {search
                ? `Keine Bestellungen gefunden für „${search}“.`
                : filter === 'alle'
                  ? 'Noch keine Bestellungen.'
                  : `Keine Bestellungen mit Status „${ORDER_STATUS_LABELS[filter as OrderStatus] ?? filter}“.`}
            </p>
          )}
          {shown.length > 0 && (
            <div className="flex items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
              <span>
                {shown.length}
                {total != null ? ` von ${total}` : ''} Bestellungen
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
