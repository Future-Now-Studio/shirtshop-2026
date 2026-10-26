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
    // A reorder is "the same again": keep print position and print file.
    printPosition: it.printPosition,
    artworkName: it.artworkName,
    artworkPath: it.artworkPath,
  }))
}

// Parts of a note that belong to the old order only: the quote reference
// written by accept_quote and the PO / date / address that older orders
// stored flattened into the note ("Bestellzeichen: … · Lieferung: …").
const ORDER_ONLY = /^(Aus Angebot |Bestellzeichen:|Wunschtermin:|Lieferung:)/
const FLATTENED = /^(Bestellzeichen|Wunschtermin|Lieferung):/

/** The production remarks of a past order, without its order-specific parts. */
export function reorderNote(note?: string): string {
  if (!note) return ''
  return note
    .split('\n')
    // Only old flattened lines are split at " · "; a customer's own remark
    // ("Brust links · Rücken groß") stays as written.
    .flatMap((line) => (FLATTENED.test(line.trim()) ? line.split(' · ') : [line]))
    .map((p) => p.trim())
    .filter((p) => p && !ORDER_ONLY.test(p))
    .join('\n')
}
