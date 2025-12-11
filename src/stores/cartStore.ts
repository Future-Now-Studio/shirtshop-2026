import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  productId: number;
  name: string;
  price: number;
  image: string;
  color: string;
  size: string;
  quantity: number;
  customDesign?: string; // Base64 of final design image (with shirt) - deprecated, use customDesigns
  customDesigns?: Record<string, string>; // Object with view keys (front, back, left, right) and base64 images
  customDesignRaw?: string; // JSON string of raw canvas elements (text, images, etc.)
  designElementCount?: number; // Number of design elements (text, images, etc.) - each adds 10€
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getItemPrice: (item: CartItem) => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        const id = `${item.productId}-${item.color}-${item.size}-${Date.now()}`;
        set((state) => ({
          items: [...state.items, { ...item, id }],
          isOpen: true,
        }));
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      updateQuantity: (id, quantity) => {
        if (quantity < 1) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get().items.reduce((total, item) => {
          // Base price + (design elements * 10€) per item, multiplied by quantity
          const pricePerUnit = item.price + ((item.designElementCount || 0) * 10);
          return total + (pricePerUnit * item.quantity);
        }, 0);
      },
      
      // Get price for a specific item
      getItemPrice: (item: CartItem) => {
        // Base price + (design elements * 10€) per unit
        const pricePerUnit = item.price + ((item.designElementCount || 0) * 10);
        return pricePerUnit * item.quantity;
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);
