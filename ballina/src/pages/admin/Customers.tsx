import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { Loader2, Plus, Search } from 'lucide-react'
import { adminGetCustomersPage } from '@/lib/adminApi'
import { useDebounced } from '@/lib/useDebounced'
import { formatEUR } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export default function Customers() {
  const [q, setQ] = useState('')
  const search = useDebounced(q.trim(), 300)
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin', 'customers', 'list', search],
    queryFn: ({ pageParam }) => adminGetCustomersPage(search, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.reduce((n, p) => n + p.rows.length, 0) : undefined,
    placeholderData: keepPreviousData,
  })
  const filtered = data?.pages.flatMap((p) => p.rows) ?? []
  const total = data?.pages[0]?.total

  return (
    <div>
      <PageHeader
        title="Kunden"
        description="Alle Geschäftskunden – suchen, Konditionen prüfen, Angebote erstellen."
        action={
          <Link to="/admin/kunden/neu">
            <Button variant="brand" size="lg">
              <Plus className="size-4" />
              Neuer Kunde
            </Button>
          </Link>
        }
      />

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Firma, Kd-Nr., Ansprechpartner oder Ort suchen…"
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
        />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="rounded-xl border border-dashed border-destructive/40 py-12 text-center text-sm text-destructive">
          Kunden konnten nicht geladen werden: {(error as Error)?.message ?? 'Unbekannter Fehler'}
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {filtered.length}
            {total != null ? ` von ${total}` : ''} Kunden{search ? ` für „${search}“` : ''}
          </p>
          <Card className="overflow-hidden">
            {/* Header row (desktop) */}
            <div className="hidden grid-cols-[1fr_104px_1fr_84px_112px_128px] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Firma</span>
              <span>Kd-Nr.</span>
              <span>Ansprechpartner</span>
              <span className="text-right">Rabatt</span>
              <span className="text-right">Budget</span>
              <span></span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-1 gap-1 px-5 py-3 text-sm lg:grid-cols-[1fr_104px_1fr_84px_112px_128px] lg:items-center lg:gap-4"
                >
                  <div className="min-w-0">
                    <Link to={`/admin/kunde/${c.id}`} className="font-medium hover:text-brand">
                      {c.company}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground lg:hidden">
                      {c.customerNumber} · {c.contactPerson}
                    </p>
                  </div>
                  <span className="hidden text-muted-foreground lg:block">{c.customerNumber}</span>
                  <span className="hidden min-w-0 truncate lg:block">
                    {c.contactPerson}
                    <span className="text-muted-foreground"> · {c.billingAddress?.city ?? '—'}</span>
                  </span>
                  <span className="hidden text-right lg:block">
                    {c.discountPercent ? <Badge variant="brand">–{c.discountPercent}%</Badge> : <span className="text-muted-foreground">—</span>}
                  </span>
                  <span className="hidden text-right tabular-nums text-muted-foreground lg:block">
                    {c.annualBudget ? formatEUR(c.annualBudget) : '—'}
                  </span>
                  <div className="flex gap-3 text-xs lg:justify-end">
                    <Link to={`/admin/kunde/${c.id}`} className="font-medium text-brand hover:underline">
                      Details
                    </Link>
                    <Link to={`/admin/angebote/neu?kunde=${c.id}`} className="font-medium text-muted-foreground hover:text-foreground">
                      Angebot
                    </Link>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                  {search ? `Kein Kunde gefunden für „${search}“.` : 'Noch keine Kunden angelegt.'}
                </p>
              )}
            </div>
          </Card>
          {hasNextPage && (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                Mehr laden
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
