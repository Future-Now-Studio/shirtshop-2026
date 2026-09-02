import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartLine } from '@/lib/types'

interface CartState {
  lines: CartLine[]
  add: (line: CartLine) => void
  updateQty: (index: number, quantity: number) => void
  remove: (index: number) => void
  clear: () => void
  replaceAll: (lines: CartLine[]) => void
  count: () => number
  total: () => number
}

// Two lines are "the same" when product + color + size match → quantities merge.
const sameLine = (a: CartLine, b: CartLine) =>
  a.productId === b.productId && a.color === b.color && a.size === b.size

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (line) =>
        set((s) => {
          const idx = s.lines.findIndex((l) => sameLine(l, line))
          if (idx >= 0) {
            const lines = [...s.lines]
            lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + line.quantity }
            return { lines }
          }
          return { lines: [...s.lines, line] }
        }),
      updateQty: (index, quantity) =>
        set((s) => {
          const lines = [...s.lines]
          if (lines[index]) lines[index] = { ...lines[index], quantity: Math.max(1, quantity) }
          return { lines }
        }),
      remove: (index) => set((s) => ({ lines: s.lines.filter((_, i) => i !== index) })),
      clear: () => set({ lines: [] }),
      replaceAll: (lines) => set({ lines }),
      count: () => get().lines.reduce((n, l) => n + l.quantity, 0),
      total: () => get().lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    }),
    { name: 'ballina_cart' },
  ),
)
