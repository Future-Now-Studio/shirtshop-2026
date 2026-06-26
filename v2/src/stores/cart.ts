import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  key: string; // unique line key
  productId: string;
  productName: string;
  slug: string;
  variantId: string;
  colorName: string;
  sizeId: string | null;
  sizeName: string | null;
  qty: number;
  basePrice: number;
  designElementPrice: number;
  designElementCount: number;
  // Per-view rendered design previews (data URLs) and raw fabric JSON
  designRenders?: Record<string, string>;
  designData?: string;
  thumbnail?: string;
}

export function unitPrice(i: CartItem) {
  return i.basePrice + i.designElementCount * i.designElementPrice;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "key">) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((s) => ({
          items: [...s.items, { ...item, key: `${item.variantId}-${item.sizeId}-${s.items.length}-${item.designElementCount}` }],
        })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      setQty: (key, qty) =>
        set((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, qty) } : i)) })),
      clear: () => set({ items: [] }),
    }),
    { name: "shirtshop-v2-cart" }
  )
);
