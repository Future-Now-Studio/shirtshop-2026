import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { CartLine } from './types'
import { OrderConfirmDialog, type OrderConfirmOpts } from '@/components/OrderConfirmDialog'

interface OrderFlowValue {
  /** Open the confirmation dialog for the given lines before placing the order. */
  startOrder: (lines: CartLine[], opts?: OrderConfirmOpts) => void
}

const OrderFlowContext = createContext<OrderFlowValue | undefined>(undefined)

export function OrderFlowProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[] | null>(null)
  const [opts, setOpts] = useState<OrderConfirmOpts>({})

  const startOrder = useCallback((newLines: CartLine[], newOpts: OrderConfirmOpts = {}) => {
    if (newLines.length === 0) return
    setOpts(newOpts)
    setLines(newLines)
  }, [])

  return (
    <OrderFlowContext.Provider value={{ startOrder }}>
      {children}
      {lines && (
        <OrderConfirmDialog lines={lines} opts={opts} onClose={() => setLines(null)} />
      )}
    </OrderFlowContext.Provider>
  )
}

export function useOrderFlow() {
  const ctx = useContext(OrderFlowContext)
  if (!ctx) throw new Error('useOrderFlow must be used within OrderFlowProvider')
  return ctx
}
