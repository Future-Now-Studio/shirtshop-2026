import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { Download, Loader2, Plus, Search, X } from 'lucide-react'
import {
  adminExportOrders,
  adminGetOrderCounts,
  adminGetOrdersPage,
  type OrderFilter,
  type OrderQuery,
} from '@/lib/adminApi'
import { useDebounced } from '@/lib/useDebounced'
import { cn, formatDate, formatEUR } from '@/lib/utils'
import { ORDER_STATUS_LABELS, RECLAMATION_STATUS_LABELS, type OrderStatus } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { PageHeader } from '@/components/PageHeader'
import { berlinToday, downloadText, ordersCsv } from './adminFormat'

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'unbestaetigt', label: 'Preise unbestätigt' },
  { key: 'reklamation', label: 'Reklamationen' },
  { key: 'offen', label: 'Offen' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung' },
  { key: 'versendet', label: 'Versendet' },
  { key: 'abgeschlossen', label: 'Abgeschlossen' },
  { key: 'storniert', label: 'Storniert' },
]
const FILTER_KEYS = FILTERS.map((f) => f.key)

function emptyText(q: OrderQuery): string {
  if (q.search) return `Keine Bestellungen gefunden für „${q.search}“.`
  if (q.from || q.to) return 'Keine Bestellungen in diesem Zeitraum.'
  if (q.filter === 'alle') return 'Noch keine Bestellungen.'
  if (q.filter === 'unbestaetigt') return 'Keine Bestellungen mit unbestätigten Preisen.'
  if (q.filter === 'reklamation') return 'Keine offenen Reklamationen.'
  return `Keine Bestellungen mit Status „${ORDER_STATUS_LABELS[q.filter as OrderStatus] ?? q.filter}“.`
}

export default function AdminOrders() {
  // Filter lives in the URL so dashboard KPIs can link to e.g. ?filter=unbestaetigt.
  const [params, setParams] = useSearchParams()
  const rawFilter = params.get('filter') as OrderFilter | null
  const filter: OrderFilter = rawFilter && FILTER_KEYS.includes(rawFilter) ? rawFilter : 'alle'
  function setFilter(f: OrderFilter) {
    const next = new URLSearchParams(params)
    if (f === 'alle') next.delete('filter')
    else next.set('filter', f)
    setParams(next, { replace: true })
  }

  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const search = useDebounced(q.trim(), 300)
  const query: OrderQuery = { filter, search, from: from || undefined, to: to || undefined }

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin', 'orders', 'list', query],
    queryFn: ({ pageParam }) => adminGetOrdersPage(query, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.reduce((n, p) => n + p.rows.length, 0) : undefined,
    placeholderData: keepPreviousData,
  })
  const { data: counts } = useQuery({ queryKey: ['admin', 'orders', 'counts'], queryFn: adminGetOrderCounts })
  const shown = data?.pages.flatMap((p) => p.rows) ?? []
  const total = data?.pages[0]?.total

  const exportCsv = useMutation({
    mutationFn: async (withItems: boolean) => {
      const rows = await adminExportOrders(query, withItems)
      if (!rows.length) throw new Error('Keine Bestellungen für den Export.')
      const name = `bestellungen${withItems ? '-positionen' : ''}-${berlinToday()}.csv`
      downloadText(name, ordersCsv(rows, withItems))
      return rows.length
    },
  })

  return (
    <div>
      <PageHeader
        title="Bestellungen"
        description="Alle Kundenbestellungen – Status, Preise, Reklamationen und Versand pflegen."
        action={
          <Link to="/admin/bestellungen/neu">
            <Button variant="brand" size="lg">
              <Plus className="size-4" />
              Neue Bestellung
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Bestellnr., Firma, Kd-Nr. oder Bestellzeichen…"
            aria-label="Bestellungen durchsuchen"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="from" className="text-xs text-muted-foreground">Bestellt von</Label>
            <Input id="from" type="date" className="h-10 w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to" className="text-xs text-muted-foreground">bis</Label>
            <Input id="to" type="date" className="h-10 w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <Button variant="ghost" size="sm" className="h-10" onClick={() => { setFrom(''); setTo('') }}>
              <X className="size-4" /> Zeitraum löschen
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
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

      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Export der aktuellen Auswahl (CSV für Excel):</span>
        <Button variant="outline" size="sm" onClick={() => exportCsv.mutate(false)} disabled={exportCsv.isPending}>
          {exportCsv.isPending && exportCsv.variables === false ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          Bestellungen
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportCsv.mutate(true)} disabled={exportCsv.isPending}>
          {exportCsv.isPending && exportCsv.variables === true ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          Positionen
        </Button>
        {exportCsv.isError && (
          <span role="alert" className="text-destructive">{(exportCsv.error as Error).message}</span>
        )}
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
                    {o.priceConfirmed === false && o.status !== 'storniert' && (
                      <Badge variant="warning">Preise unbestätigt</Badge>
                    )}
                    {o.reclamation && (
                      <Badge variant={o.reclamationStatus === 'erledigt' ? 'neutral' : 'destructive'}>
                        Reklamation: {RECLAMATION_STATUS_LABELS[o.reclamationStatus ?? 'offen']}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{o.companyName}</span>
                    <span className="text-muted-foreground">
                      {' '}· {o.itemCount} {o.itemCount === 1 ? 'Position' : 'Positionen'}
                      {o.poNumber ? ` · Zeichen: ${o.poNumber}` : ''}
                      {o.requestedDate ? ` · Wunschtermin ${formatDate(o.requestedDate)}` : ''}
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
              {emptyText(query)}
            </p>
          )}
          {shown.length > 0 && (
            <div className="flex items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
              <span>
                {shown.length}
                {total != null ? ` von ${total}` : ''} Bestellungen · Beträge netto (Warenwert)
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
