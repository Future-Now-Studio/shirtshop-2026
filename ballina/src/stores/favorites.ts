import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// #9 "Mein Sortiment" — the customer's pinned standard articles (by product id).
interface FavoritesState {
  ids: string[]
  toggle: (id: string) => void
  has: (id: string) => boolean
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set((s) => ({
          ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id],
        })),
      has: (id) => get().ids.includes(id),
    }),
    { name: 'ballina_favorites' },
  ),
)
