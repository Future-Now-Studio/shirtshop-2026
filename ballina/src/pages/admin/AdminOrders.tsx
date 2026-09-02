import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { adminGetOrders } from '@/lib/adminApi'
import { cn, formatDate, formatEUR } from '@/lib/utils'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

const FILTERS: { key: OrderStatus | 'alle'; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'offen', label: 'Offen' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung' },
  { key: 'versendet', label: 'Versendet' },
  { key: 'abgeschlossen', label: 'Abgeschlossen' },
]

export default function AdminOrders() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: adminGetOrders,
  })
  const [filter, setFilter] = useState<OrderStatus | 'alle'>('alle')
  const shown = filter === 'alle' ? orders : orders.filter((o) => o.status === filter)

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
            {f.key !== 'alle' && (
              <span className="ml-1 text-xs">
                ({orders.filter((o) => o.status === f.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
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
                      {' '}· {o.items.length} Positionen
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
              Keine Bestellungen mit Status „{ORDER_STATUS_LABELS[filter as OrderStatus] ?? filter}".
            </p>
          )}
        </div>
      )}
    </div>
  )
}
