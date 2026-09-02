import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Grid3x3, Heart, Loader2, Minus, Plus, ShoppingCart } from 'lucide-react'
import { getCompany, getProducts } from '@/lib/api'
import { cn, formatEUR, tierListPrice, tierNetPrice } from '@/lib/utils'
import { useCart } from '@/stores/cart'
import { useFavorites } from '@/stores/favorites'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SizeMatrixDialog } from '@/components/SizeMatrixDialog'

export default function ProductDetail() {
  const { id = '' } = useParams()
  const { data: products = [], isLoading } = useQuery({ queryKey: ['products'], queryFn: getProducts })
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: getCompany })
  const add = useCart((s) => s.add)
  const favIds = useFavorites((s) => s.ids)
  const toggleFav = useFavorites((s) => s.toggle)

  const product = products.find((p) => p.id === id)
  const discount = company?.discountPercent ?? 0
  const moq = product?.minOrderQty ?? 1
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')
  const [qty, setQty] = useState(Math.max(moq, 10))
  const [added, setAdded] = useState(false)
  const [matrixOpen, setMatrixOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!product) {
    return (
      <Card className="grid place-items-center gap-3 py-16 text-center">
        <p className="font-medium">Produkt nicht gefunden</p>
        <Link to="/katalog"><Button variant="outline">Zum Katalog</Button></Link>
      </Card>
    )
  }

  const c = color || product.colors[0] || ''
  const s = size || product.sizes[0] || ''
  const unit = tierNetPrice(product, qty, discount)
  const listAtQty = tierListPrice(product, qty)
  const isFav = favIds.includes(product.id)

  function handleAdd() {
    add({ productId: product!.id, productName: product!.name, imageUrl: product!.imageUrl, color: c, size: s, quantity: qty, unitPrice: unit })
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }

  return (
    <div>
      <Link to="/katalog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Katalog
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
          <img src={product.imageUrl} alt={product.name} className="aspect-square size-full object-cover" />
          <button
            onClick={() => toggleFav(product.id)}
            className={cn('absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-border bg-background/90 backdrop-blur hover:bg-background', isFav && 'text-brand')}
            aria-label="Mein Sortiment"
          >
            <Heart className={cn('size-5', isFav && 'fill-current')} />
          </button>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{product.category} · Art.-Nr. {product.sku}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{product.description}</p>

          <div className="mt-4 flex items-baseline gap-2">
            {unit < listAtQty && <span className="text-sm text-muted-foreground line-through">{formatEUR(listAtQty)}</span>}
            <span className="text-2xl font-semibold text-brand">{formatEUR(unit)}</span>
            <span className="text-sm text-muted-foreground">netto / Stück</span>
          </div>

          {product.priceTiers && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {moq > 1 && <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">ab {moq} Stück</span>}
              {product.priceTiers.map((t) => (
                <span key={t.minQty} className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', qty >= t.minQty ? 'bg-brand-muted text-brand' : 'bg-muted text-muted-foreground')}>
                  {t.minQty}+ : {formatEUR(t.unitPrice)}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-muted-foreground">Farbe</span>
              <select value={c} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:border-ring focus-visible:outline-none">
                {product.colors.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-muted-foreground">Größe</span>
              <select value={s} onChange={(e) => setSize(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:border-ring focus-visible:outline-none">
                {product.sizes.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex h-11 items-center rounded-lg border border-input">
              <button onClick={() => setQty((v) => Math.max(moq, v - 1))} className="grid size-11 place-items-center text-muted-foreground hover:text-foreground"><Minus className="size-4" /></button>
              <input type="number" min={moq} value={qty} onChange={(e) => setQty(Math.max(moq, Number(e.target.value) || moq))} className="h-11 w-14 border-0 bg-transparent text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <button onClick={() => setQty((v) => v + 1)} className="grid size-11 place-items-center text-muted-foreground hover:text-foreground"><Plus className="size-4" /></button>
            </div>
            <Button variant={added ? 'secondary' : 'brand'} size="lg" className="flex-1" onClick={handleAdd}>
              {added ? <><Check className="size-4" /> Hinzugefügt</> : <><ShoppingCart className="size-4" /> In den Warenkorb</>}
            </Button>
          </div>

          <button onClick={() => setMatrixOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-brand">
            <Grid3x3 className="size-4" /> Mengen je Größe (Staffel)
          </button>
        </div>
      </div>

      {matrixOpen && <SizeMatrixDialog product={product} discountPercent={discount} onClose={() => setMatrixOpen(false)} />}
    </div>
  )
}
