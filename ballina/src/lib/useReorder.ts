import { useNavigate } from 'react-router-dom'
import { orderToCartLines } from './reorder'
import { useOrderFlow } from './orderFlow'
import { useCart } from '@/stores/cart'
import type { Order } from './types'

/** Shared reorder actions used by Dashboard, Orders list and Order detail. */
export function useReorder() {
  const navigate = useNavigate()
  const replaceAll = useCart((s) => s.replaceAll)
  const { startOrder } = useOrderFlow()

  // Open the confirmation dialog (quantities + billing/delivery) before placing.
  function quickReorder(order: Order) {
    startOrder(orderToCartLines(order), {
      title: `Nachbestellung zu #${order.orderNumber}`,
      submitLabel: 'Verbindlich nachbestellen',
      defaultNote: order.note,
    })
  }

  // Load the order into the cart so the customer can tweak it on the cart page.
  function adjust(order: Order) {
    replaceAll(orderToCartLines(order))
    navigate('/warenkorb')
  }

  return {
    quickReorder,
    adjustReorder: adjust,
    isReordering: false,
    reorderingId: undefined as string | undefined,
  }
}
