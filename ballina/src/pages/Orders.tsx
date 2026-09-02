import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, RefreshCw, ShoppingBag } from 'lucide-react'
import { getOrders } from '@/lib/api'
import { formatDate, formatEUR } from '@/lib/utils'
import { useReorder } from '@/lib/useReorder'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { PageHeader } from '@/components/PageHeader'
import { OrderItemsPreview } from '@/components/OrderItemsPreview'

export default function Orders() {
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['orders'], queryFn: getOrders })
  const { quickReorder, isReordering, reorderingId } = useReorder()

  return (
    <div>
      <PageHeader
        title="Bestellungen"
        description="Alle Ihre Aufträge – nachbestellen mit einem Klick."
        action={
          <Link to="/anfrage">
            <Button variant="brand" size="lg">
              Neue Anfrage
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="grid place-items-center gap-3 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <ShoppingBag className="size-6" />
          </div>
          <div>
            <p className="font-medium">Noch keine Bestellungen</p>
            <p className="text-sm text-muted-foreground">
              Stellen Sie eine Anfrage – Sie erhalten ein Angebot, das Sie mit einem Klick annehmen.
            </p>
          </div>
          <Link to="/anfrage">
            <Button variant="brand">Anfrage stellen</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-semibold">#{order.orderNumber}</span>
                    <StatusBadge status={order.status} />
                    <span className="text-sm text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <OrderItemsPreview items={order.items} />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{order.items.length} Positionen</p>
                    <p className="text-lg font-semibold tracking-tight">
                      {formatEUR(order.total)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/bestellung/${order.id}`}>
                      <Button variant="outline" size="sm">
                        Details
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => quickReorder(order)}
                      disabled={isReordering}
                    >
                      {isReordering && reorderingId === order.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      Nachbestellen
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
