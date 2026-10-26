import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { getOrder } from '@/lib/api'
import { formatDay, formatEUR, grossFrom, VAT_RATE } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/load-state'

export default function OrderSuccess() {
  const { id = '' } = useParams()
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id),
  })

  // The order is placed already — if only the summary fails to load, the
  // thank-you text and the links below still apply.
  if (isLoading) return <LoadingState />

  return (
    <div className="mx-auto max-w-lg py-8 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-success/12 text-success">
        <CheckCircle2 className="size-8" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Bestellung eingegangen</h1>
      <p className="mt-2 text-muted-foreground">
        Vielen Dank! Ihre Bestellung{' '}
        {order && <span className="font-medium text-foreground">#{order.orderNumber}</span>} wurde
        erfolgreich übermittelt. Wir melden uns mit der Auftragsbestätigung; den Status sehen Sie
        jederzeit unter „Bestellungen“.
      </p>


      {order && (
        <Card className="mt-6 p-5 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Positionen</span>
            <span className="font-medium">{order.items.length}</span>
          </div>
          {order.poNumber && (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Bestellzeichen</span>
              <span>{order.poNumber}</span>
            </div>
          )}
          {order.requestedDate && (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Wunschtermin</span>
              <span>{formatDay(order.requestedDate)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Warenwert (netto)</span>
            <span>{formatEUR(order.total)}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Versand (netto)</span>
            <span>{order.shipping ? formatEUR(order.shipping) : 'kostenlos'}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm">
            <span className="text-muted-foreground">Gesamt (brutto, inkl. {Math.round(VAT_RATE * 100)} % USt.)</span>
            <span className="font-semibold">{formatEUR(grossFrom(order.total + (order.shipping ?? 0)))}</span>
          </div>
          {order.priceConfirmed === false && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Vorläufige Preise – unser Team bestätigt die Preise in Kürze.
            </p>
          )}
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
