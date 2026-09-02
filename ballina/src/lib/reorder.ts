import type { CartLine, Order } from './types'

/** Map a past order's line items into fresh cart lines (for reordering). */
export function orderToCartLines(order: Order): CartLine[] {
  return order.items.map((it) => ({
    productId: it.productId,
    productName: it.productName,
    imageUrl: it.imageUrl,
    color: it.color,
    size: it.size,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
  }))
}
