import { useMemo, useState } from 'react'
import { X, ShoppingCart } from 'lucide-react'
import type { Product } from '@/lib/types'
import { formatEUR, tierNetPrice } from '@/lib/utils'
import { useCart } from '@/stores/cart'
import { Button } from '@/components/ui/button'

// #2 Größen-Matrix: enter a quantity per size for a chosen colour, add all at once.
export function SizeMatrixDialog({
  product,
  discountPercent = 0,
  onClose,
}: {
  product: Product
  discountPercent?: number
  onClose: () => void
}) {
  const add = useCart((s) => s.add)
  const [color, setColor] = useState(product.colors[0] ?? '')
  const [qty, setQty] = useState<Record<string, number>>({})

  const totalQty = useMemo(
    () => Object.values(qty).reduce((s, n) => s + (n || 0), 0),
    [qty],
  )
  // Staffelpreis based on the whole matrix quantity.
  const unit = tierNetPrice(product, totalQty, discountPercent)
  const totalValue = totalQty * unit

  function setSize(size: string, value: number) {
    setQty((q) => ({ ...q, [size]: Math.max(0, value || 0) }))
  }

  function handleAdd() {
    product.sizes.forEach((size) => {
      const q = qty[size] || 0
      if (q > 0) {
        add({
          productId: product.id,
          productName: product.name,
          imageUrl: product.imageUrl,
          color,
          size,
          quantity: q,
          unitPrice: unit,
        })
      }
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="flex items-center gap-3">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="size-12 rounded-lg border border-border object-cover"
            />
            <div>
              <h3 className="font-semibold tracking-tight">{product.name}</h3>
              <p className="text-sm text-muted-foreground">
                Mengen je Größe · {formatEUR(unit)} / Stück
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Schließen">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">Farbe</span>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              {product.colors.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
            {product.sizes.map((size) => (
              <label key={size} className="rounded-lg border border-border p-2 text-center">
                <span className="block text-xs font-semibold">{size}</span>
                <input
                  type="number"
                  min={0}
                  value={qty[size] || ''}
                  placeholder="0"
                  onChange={(e) => setSize(size, Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background text-center text-sm focus:border-ring focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/30 p-5">
          <div className="text-sm">
            <span className="text-muted-foreground">{totalQty} Stück · </span>
            <span className="font-semibold">{formatEUR(totalValue)}</span>
          </div>
          <Button variant="brand" onClick={handleAdd} disabled={totalQty === 0}>
            <ShoppingCart className="size-4" />
            {totalQty > 0 ? `${totalQty} in den Warenkorb` : 'Mengen eingeben'}
          </Button>
        </div>
      </div>
    </div>
  )
}
