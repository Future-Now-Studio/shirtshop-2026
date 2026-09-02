import type { OrderItem } from '@/lib/types'
import { ITEM_PLACEHOLDER } from '@/lib/utils'

/** Compact overlapping thumbnail row summarising an order's items. */
export function OrderItemsPreview({ items, max = 4 }: { items: OrderItem[]; max?: number }) {
  const shown = items.slice(0, max)
  const rest = items.length - shown.length
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((it) => (
          <img
            key={it.id}
            src={it.imageUrl || ITEM_PLACEHOLDER}
            alt={it.productName}
            loading="lazy"
            className="size-9 rounded-md border-2 border-background object-cover"
          />
        ))}
        {rest > 0 && (
          <div className="grid size-9 place-items-center rounded-md border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
            +{rest}
          </div>
        )}
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {shown.map((it) => it.productName).join(', ')}
        {rest > 0 ? ' …' : ''}
      </span>
    </div>
  )
}
