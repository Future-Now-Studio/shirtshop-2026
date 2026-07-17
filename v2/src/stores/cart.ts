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
  // Design media lives in Supabase Storage under order-designs/<designId>/.
  // The cart keeps only the id + a lightweight manifest + a tiny preview.
  designId?: string;
  designManifest?: any[];
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
  setSize: (key: string, sizeId: string, sizeName: string) => void;
  clear: () => void;
}

// Lines with the same variant+size+design are one logical position.
const sig = (i: Pick<CartItem, "variantId" | "sizeId" | "designId" | "designElementCount">) =>
  `${i.variantId}|${i.sizeId}|${i.designId ?? ""}|${i.designElementCount}`;

/** Collapse duplicate lines (same signature) into one, summing quantities. */
function mergeLines(items: CartItem[]): CartItem[] {
  const out: CartItem[] = [];
  for (const i of items) {
    const hit = out.find((o) => sig(o) === sig(i));
    if (hit) hit.qty += i.qty;
    else out.push({ ...i });
  }
  return out;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((s) => ({ items: mergeLines([...s.items, { ...item, key: crypto.randomUUID() }]) })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      setQty: (key, qty) =>
        set((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, qty) } : i)) })),
      setSize: (key, sizeId, sizeName) =>
        set((s) => ({
          items: mergeLines(s.items.map((i) => (i.key === key ? { ...i, sizeId, sizeName } : i))),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "shirtshop-v2-cart" }
  )
);
