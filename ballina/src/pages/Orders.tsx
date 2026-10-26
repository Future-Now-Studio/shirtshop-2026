import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Download, RefreshCw, Search, ShoppingBag } from 'lucide-react'
import { getCompany, getOrders } from '@/lib/api'
import {
  berlinYear,
  budgetPending,
  budgetSpent,
  cn,
  downloadCsv,
  formatDate,
  formatDay,
  formatEUR,
  grossFrom,
} from '@/lib/utils'
import { useReorder } from '@/lib/useReorder'
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LoadError, LoadingState } from '@/components/ui/load-state'
import { PageHeader } from '@/components/PageHeader'
import { OrderItemsPreview } from '@/components/OrderItemsPreview'
import { BudgetBar } from '@/components/BudgetBar'

const PAGE = 20
const FILTERS: ('alle' | OrderStatus)[] = ['alle', 'offen', 'in_bearbeitung', 'versendet', 'abgeschlossen', 'storniert']

function matches(o: Order, q: string): boolean {
  if (!q) return true
  const hay = [o.orderNumber, o.poNumber, o.note, ...o.items.map((i) => i.productName)].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).every((t) => hay.includes(t))
}

/** One CSV row per position — easy to filter by Bestellzeichen / article in Excel. */
function exportCsv(orders: Order[]) {
  const rows: (string | number | undefined)[][] = [[
    'Bestellnummer', 'Datum', 'Status', 'Bestellzeichen', 'Wunschtermin', 'Artikel', 'Farbe', 'Größe',
    'Menge', 'Einzelpreis netto', 'Summe netto', 'Versand netto (Bestellung)', 'Gesamt brutto (Bestellung)', 'Preise bestätigt',
  ]]
  for (const o of orders) {
    const gross = grossFrom(o.total + (o.shipping ?? 0))
    for (const it of o.items) {
      rows.push([
        o.orderNumber, formatDate(o.createdAt), ORDER_STATUS_LABELS[o.status], o.poNumber,
        o.requestedDate ? formatDay(o.requestedDate) : undefined,
        it.productName, it.color, it.size, it.quantity, it.unitPrice, Math.round(it.unitPrice * it.quantity * 100) / 100,
        o.shipping ?? 0, gross, o.priceConfirmed === false ? 'nein' : 'ja',
      ])
    }
  }
  downloadCsv(`bestellungen-${new Date().toISOString().slice(0, 10)}.csv`, rows)
}

export default function Orders() {
  const { data: orders = [], isLoading, isError, refetch } = useQuery({ queryKey: ['orders'], queryFn: getOrders })
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: getCompany })
  const { quickReorder } = useReorder()
  const [status, setStatus] = useState<'alle' | OrderStatus>('alle')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const budget = company?.annualBudget
  const year = berlinYear()

  const counts = useMemo(() => {
    const c: Record<string, number> = { alle: orders.length }
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1
    return c
  }, [orders])
  const filtered = useMemo(
    () => orders.filter((o) => (status === 'alle' || o.status === status) && matches(o, search.trim())),
    [orders, status, search],
  )
  const shown = filtered.slice(0, limit)

  return (
    <div>
      <PageHeader
        title="Bestellungen"
        description="Alle Ihre Aufträge – nachbestellen mit einem Klick."
        action={
          <>
            {orders.length > 0 && (
              <Button variant="outline" size="lg" onClick={() => exportCsv(filtered)} title="Gefilterte Bestellungen als CSV (Excel) herunterladen">
                <Download className="size-4" /> CSV-Export
              </Button>
            )}
            <Link to="/angebote?tab=anfrage">
              <Button variant="brand" size="lg">
                Neue Anfrage
              </Button>
            </Link>
          </>
        }
      />

      {budget != null && budget > 0 && !isLoading && !isError && (
        <BudgetBar
          className="-mt-4 mb-6"
          spent={budgetSpent(orders, year)}
          pending={budgetPending(orders, year)}
          budget={budget}
          year={year}
        />
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <LoadError what="Ihre Bestellungen" onRetry={() => refetch()} />
      ) : orders.length === 0 ? (
        <Card className="grid place-items-center gap-3 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <ShoppingBag className="size-6" />
          </div>
          <div>
            <p className="font-medium">Noch keine Bestellungen</p>
            <p className="text-sm text-muted-foreground">
              Stellen Sie eine Anfrage – Sie erhalten ein Angebot, das Sie hier im Portal annehmen.
            </p>
          </div>
          <Link to="/angebote?tab=anfrage">
            <Button variant="brand">Anfrage stellen</Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Nach Status filtern">
              {FILTERS.filter((f) => f === 'alle' || counts[f]).map((f) => (
                <button
                  key={f}
                  onClick={() => { setStatus(f); setLimit(PAGE) }}
                  aria-pressed={status === f}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    status === f
                      ? 'border-brand bg-brand-muted text-brand'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f === 'alle' ? 'Alle' : ORDER_STATUS_LABELS[f]} ({counts[f] ?? 0})
                </button>
              ))}
            </div>
            <div className="relative lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setLimit(PAGE) }}
                placeholder="Bestellnr., Bestellzeichen, Artikel…"
                aria-label="Bestellungen durchsuchen"
                className="pl-9"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <Card className="py-12 text-center text-sm text-muted-foreground">
              Keine Bestellungen für diese Auswahl.{' '}
              <button className="font-medium text-brand hover:underline" onClick={() => { setStatus('alle'); setSearch('') }}>
                Filter zurücksetzen
              </button>
            </Card>
          ) : (
            <div className="space-y-3">
              {shown.map((order) => (
                <Card key={order.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-base font-semibold">#{order.orderNumber}</span>
                        <StatusBadge status={order.status} />
                        {order.priceConfirmed === false && order.status !== 'storniert' && (
                          <Badge variant="warning">Preise vorläufig</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {formatDate(order.createdAt)}
                          {order.poNumber ? ` · Zeichen ${order.poNumber}` : ''}
                        </span>
                      </div>
                      <div className="mt-3">
                        <OrderItemsPreview items={order.items} />
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{order.items.length} {order.items.length === 1 ? 'Position' : 'Positionen'}</p>
                        <p className="text-lg font-semibold tracking-tight">
                          {formatEUR(order.total)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">netto</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/bestellung/${order.id}`}>
                          <Button variant="outline" size="sm">
                            Details
                          </Button>
                        </Link>
                        <Button variant="secondary" size="sm" onClick={() => quickReorder(order)}>
                          <RefreshCw className="size-3.5" />
                          Nachbestellen
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {filtered.length > shown.length && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                    Weitere anzeigen ({filtered.length - shown.length})
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
