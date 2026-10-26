import { orderToCartLines, reorderNote } from './reorder'
import { useOrderFlow } from './orderFlow'
import type { Order } from './types'

/** Shared reorder action used by the Orders list and Order detail. */
export function useReorder() {
  const { startOrder } = useOrderFlow()

  // Open the confirmation dialog (quantities + billing/delivery) before placing.
  // Same lines, print data and delivery address; PO and Wunschtermin are new.
  function quickReorder(order: Order) {
    startOrder(orderToCartLines(order), {
      title: `Nachbestellung zu #${order.orderNumber}`,
      submitLabel: 'Verbindlich nachbestellen',
      defaultNote: reorderNote(order.note),
      defaultDelivery: order.deliveryAddress,
    })
  }

  return { quickReorder }
}
