import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { getOrder } from '@/lib/api'
import { formatEUR } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function OrderSuccess() {
  const { id = '' } = useParams()
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id),
  })

  if (isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg py-8 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-success/12 text-success">
        <CheckCircle2 className="size-8" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Bestellung eingegangen</h1>
      <p className="mt-2 text-muted-foreground">
        Vielen Dank! Ihre Bestellung{' '}
        {order && <span className="font-medium text-foreground">#{order.orderNumber}</span>} wurde
        erfolgreich übermittelt. Wir melden uns mit der Auftragsbestätigung.
      </p>


      {order && (
        <Card className="mt-6 p-5 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Positionen</span>
            <span className="font-medium">{order.items.length}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Gesamt (netto)</span>
            <span className="font-semibold">{formatEUR(order.total)}</span>
          </div>
        </Card>
      )}

      <div className="mt-8 flex justify-center gap-2">
        <Link to={`/bestellung/${id}`}>
          <Button variant="outline" size="lg">
            Bestellung ansehen
          </Button>
        </Link>
        <Link to="/bestellungen">
          <Button variant="brand" size="lg">
            Zu den Bestellungen
          </Button>
        </Link>
      </div>
    </div>
  )
}
