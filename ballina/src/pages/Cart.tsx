import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { formatEUR, grossFrom, ITEM_PLACEHOLDER, repriceLine, shippingFor, VAT_RATE } from '@/lib/utils'
import { getCompany, getProducts } from '@/lib/api'
import { useCart } from '@/stores/cart'
import { useOrderFlow } from '@/lib/orderFlow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'

export default function Cart() {
  const { lines, updateQty, remove, clear } = useCart()
  const { startOrder } = useOrderFlow()
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: getProducts })
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: getCompany })

  // Show Staffel-correct prices for the current quantities.
  const discount = company?.discountPercent ?? 0
  const priced = lines.map((l) => repriceLine(l, products, discount))
  const total = priced.reduce((s, l) => s + l.unitPrice * l.quantity, 0)

  function checkout() {
    startOrder(lines, {
      title: 'Bestellung prüfen & absenden',
      onPlaced: () => clear(),
    })
  }

  if (lines.length === 0) {
    return (
      <div>
        <PageHeader title="Warenkorb" />
        <Card className="grid place-items-center gap-3 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <ShoppingCart className="size-6" />
          </div>
          <div>
            <p className="font-medium">Ihr Warenkorb ist leer</p>
            <p className="text-sm text-muted-foreground">
              Bestellen Sie eine frühere Bestellung mit einem Klick nach.
            </p>
          </div>
          <Link to="/bestellungen">
            <Button variant="brand">Zu den Bestellungen</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Warenkorb" description={`${lines.length} Positionen`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Lines */}
        <div className="space-y-3">
          {priced.map((line, i) => (
            <Card key={`${line.productId}-${line.color}-${line.size}`} className="p-4">
              <div className="flex gap-4">
                <img
                  src={line.imageUrl || ITEM_PLACEHOLDER}
                  alt={line.productName}
                  className="size-16 rounded-md border border-border object-cover"
                />
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{line.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        {line.color} · Größe {line.size}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(i)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Entfernen"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex h-9 items-center rounded-lg border border-input">
                      <button
                        onClick={() => updateQty(i, line.quantity - 1)}
                        className="grid size-9 place-items-center text-muted-foreground hover:text-foreground"
                        aria-label="Menge verringern"
                      >
                        <Minus className="size-4" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateQty(i, Math.max(1, Number(e.target.value) || 1))}
                        className="h-9 w-12 border-0 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => updateQty(i, line.quantity + 1)}
                        className="grid size-9 place-items-center text-muted-foreground hover:text-foreground"
                        aria-label="Menge erhöhen"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">{formatEUR(line.unitPrice)} · </span>
                      <span className="font-semibold">
                        {formatEUR(line.unitPrice * line.quantity)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Summary */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="font-semibold tracking-tight">Zusammenfassung</h2>
            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Zwischensumme (netto)</span>
                <span>{formatEUR(total)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Versand</span>
                <span>{shippingFor(total) === 0 ? 'kostenlos' : formatEUR(shippingFor(total))}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>zzgl. 19 % USt.</span>
                <span>{formatEUR(Math.round((total + shippingFor(total)) * VAT_RATE * 100) / 100)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Gesamt (brutto)</span>
                <span>{formatEUR(grossFrom(total + shippingFor(total)))}</span>
              </div>
            </div>

            <Button variant="brand" size="xl" className="mt-4 w-full" onClick={checkout}>
              Zur Bestellprüfung
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Im nächsten Schritt Mengen, Rechnungs- und Lieferdaten bestätigen.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
