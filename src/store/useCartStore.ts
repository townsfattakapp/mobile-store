import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string;
  sku: string;
  price: number;
  image: string;
  quantity: number;
  stock_quantity: number;
};

interface CartState {
  items: CartItem[];
  isCartOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  updateQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isCartOpen: false,

      addItem: (newItem) => {
        set((state) => {
          const existingItemIndex = state.items.findIndex(
            (item) => item.productId === newItem.productId && item.variantId === newItem.variantId
          );

          if (existingItemIndex >= 0) {
            // Item exists, just increment quantity up to max stock
            const currentItems = [...state.items];
            const existingItem = currentItems[existingItemIndex];
            const newQty = Math.min(existingItem.quantity + newItem.quantity, existingItem.stock_quantity);
            currentItems[existingItemIndex] = { ...existingItem, quantity: newQty };
            return { items: currentItems, isCartOpen: true };
          } else {
            // Add new item
            return { items: [...state.items, newItem], isCartOpen: true };
          }
        });
      },

      removeItem: (productId, variantId) => {
        set((state) => ({
          items: state.items.filter(
            (item) => !(item.productId === productId && item.variantId === variantId)
          ),
        }));
      },

      updateQuantity: (productId, variantId, quantity) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.productId === productId && item.variantId === variantId) {
              // Ensure we don't exceed stock and don't go below 1
              const safeQuantity = Math.max(1, Math.min(quantity, item.stock_quantity));
              return { ...item, quantity: safeQuantity };
            }
            return item;
          }),
        }));
      },

      clearCart: () => set({ items: [] }),
      
      openCart: () => set({ isCartOpen: true }),
      closeCart: () => set({ isCartOpen: false }),

      getSubtotal: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
      },
    }),
    {
      name: 'mobile-store-cart', // key in local storage
      partialize: (state) => ({ items: state.items }), // Only persist items, not UI state like isCartOpen
    }
  )
);
