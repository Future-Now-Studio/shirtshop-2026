import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Heart, Loader2, Search } from 'lucide-react'
import { getCompany, getProducts } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useFavorites } from '@/stores/favorites'
import { PageHeader } from '@/components/PageHeader'
import { ProductCard } from '@/components/ProductCard'

export default function Catalog() {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  })
  const { data: company } = useQuery({ queryKey: ['company'], queryFn: getCompany })
  const favIds = useFavorites((s) => s.ids)
  const [category, setCategory] = useState('Alle')
  const [favOnly, setFavOnly] = useState(false)
  const [search, setSearch] = useState('')

  const discount = company?.discountPercent ?? 0

  const categories = useMemo(
    () => ['Alle', ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  )
  const q = search.trim().toLowerCase()
  const filtered = products.filter(
    (p) =>
      (category === 'Alle' || p.category === category) &&
      (!favOnly || favIds.includes(p.id)) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)),
  )

  return (
    <div>
      <PageHeader
        title="Katalog"
        description={
          discount > 0
            ? `Ihr hinterlegtes Sortiment – Preise inkl. Ihrer Firmenkondition (–${discount}%).`
            : 'Ihr hinterlegtes Sortiment zu Firmenkonditionen – zusammenstellen und bestellen.'
        }
      />

      {!isLoading && (
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Artikel oder Art.-Nr. suchen…"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          />
        </div>
      )}
      {!isLoading && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                category === c
                  ? 'border-brand bg-brand-muted text-brand'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {c}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              favOnly
                ? 'border-brand bg-brand-muted text-brand'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            <Heart className={cn('size-3.5', favOnly && 'fill-current')} />
            Mein Sortiment
            {favIds.length > 0 && <span className="text-xs">({favIds.length})</span>}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {favOnly
            ? 'Noch keine Artikel in „Mein Sortiment". Tippen Sie auf das Herz an einem Produkt.'
            : 'Keine Produkte in dieser Kategorie.'}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} discountPercent={discount} />
          ))}
        </div>
      )}
    </div>
  )
}
