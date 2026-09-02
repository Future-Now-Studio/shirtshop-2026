import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Grid3x3, Heart, Minus, Plus, ShoppingCart } from 'lucide-react'
import type { Product } from '@/lib/types'
import { cn, formatEUR, tierListPrice, tierNetPrice } from '@/lib/utils'
import { useCart } from '@/stores/cart'
import { useFavorites } from '@/stores/favorites'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SizeMatrixDialog } from '@/components/SizeMatrixDialog'

export function ProductCard({
  product,
  discountPercent = 0,
}: {
  product: Product
  discountPercent?: number
}) {
  const add = useCart((s) => s.add)
  const favIds = useFavorites((s) => s.ids)
  const toggleFav = useFavorites((s) => s.toggle)
  const isFav = favIds.includes(product.id)

  const moq = product.minOrderQty ?? 1
  const [color, setColor] = useState(product.colors[0] ?? '')
  const [size, setSize] = useState(product.sizes[0] ?? '')
  const [qty, setQty] = useState(Math.max(moq, 10))
  const [added, setAdded] = useState(false)
  const [matrixOpen, setMatrixOpen] = useState(false)

  const unit = tierNetPrice(product, qty, discountPercent)
  const listAtQty = tierListPrice(product, qty)
  const hasDiscount = unit < listAtQty
  const hasTiers = (product.priceTiers?.length ?? 0) > 0

  function handleAdd() {
    add({
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      color,
      size,
      quantity: qty,
      unitPrice: unit,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          className="size-full object-cover"
        />
        <button
          onClick={() => toggleFav(product.id)}
          className={cn(
            'absolute right-2 top-2 grid size-9 place-items-center rounded-full border border-border bg-background/90 backdrop-blur transition-colors hover:bg-background',
            isFav && 'text-brand',
          )}
          aria-label={isFav ? 'Aus Mein Sortiment entfernen' : 'Zu Mein Sortiment'}
          aria-pressed={isFav}
        >
          <Heart className={cn('size-4.5', isFav && 'fill-current')} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {product.category}
            </p>
            <Link to={`/produkt/${product.id}`} className="mt-0.5 block font-semibold tracking-tight hover:text-brand">
              {product.name}
            </Link>
          </div>
          <p className="whitespace-nowrap text-right text-sm font-semibold">
            {hasDiscount && (
              <span className="mr-1 text-xs font-normal text-muted-foreground line-through">
                {formatEUR(listAtQty)}
              </span>
            )}
            <span className={cn(hasDiscount && 'text-brand')}>{formatEUR(unit)}</span>
            <span className="block text-[11px] font-normal text-muted-foreground">
              netto / Stück
            </span>
          </p>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>

        {(hasTiers || moq > 1) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {moq > 1 && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                ab {moq} Stück
              </span>
            )}
            {product.priceTiers?.map((t) => (
              <span
                key={t.minQty}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[11px] font-medium',
                  qty >= t.minQty ? 'bg-brand-muted text-brand' : 'bg-muted text-muted-foreground',
                )}
              >
                {t.minQty}+ : {formatEUR(t.unitPrice)}
              </span>
            ))}
          </div>
        )}

        {/* Config */}
        <div className="mt-4 grid grid-cols-2 gap-2">
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
          <label className="text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">Größe</span>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              {product.sizes.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex h-9 items-center rounded-lg border border-input">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(moq, q - 1))}
              className="grid size-9 place-items-center text-muted-foreground hover:text-foreground"
              aria-label="Menge verringern"
            >
              <Minus className="size-4" />
            </button>
            <input
              type="number"
              min={moq}
              value={qty}
              onChange={(e) => setQty(Math.max(moq, Number(e.target.value) || moq))}
              className="h-9 w-12 border-0 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="grid size-9 place-items-center text-muted-foreground hover:text-foreground"
              aria-label="Menge erhöhen"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <Button variant={added ? 'secondary' : 'brand'} className="flex-1" onClick={handleAdd}>
            {added ? (
              <>
                <Check className="size-4" /> Hinzugefügt
              </>
            ) : (
              <>
                <ShoppingCart className="size-4" /> In den Warenkorb
              </>
            )}
          </Button>
        </div>

        {/* #2 Größenstaffel */}
        <button
          onClick={() => setMatrixOpen(true)}
          className="mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-brand"
        >
          <Grid3x3 className="size-3.5" />
          Mengen je Größe (Staffel)
        </button>
      </div>

      {matrixOpen && (
        <SizeMatrixDialog
          product={product}
          discountPercent={discountPercent}
          onClose={() => setMatrixOpen(false)}
        />
      )}
    </Card>
  )
}
