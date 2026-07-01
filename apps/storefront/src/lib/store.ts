import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CartState {
  cartId: string | null;
  isOpen: boolean;
  itemCount: number;
  setCartId: (id: string | null) => void;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
  setItemCount: (count: number) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      cartId: null,
      isOpen: false,
      itemCount: 0,
      setCartId: (id) => set({ cartId: id }),
      setIsOpen: (open) => set({ isOpen: open }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      setItemCount: (count) => set({ itemCount: count }),
    }),
    {
      name: "nova-cart",
      partialize: (state) => ({ cartId: state.cartId }),
    }
  )
);

interface UIState {
  isNavVisible: boolean;
  isNavSolid: boolean;
  isMenuOpen: boolean;
  isSearchOpen: boolean;
  setNavVisible: (visible: boolean) => void;
  setNavSolid: (solid: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isNavVisible: true,
  isNavSolid: false,
  isMenuOpen: false,
  isSearchOpen: false,
  setNavVisible: (visible) => set({ isNavVisible: visible }),
  setNavSolid: (solid) => set({ isNavSolid: solid }),
  setMenuOpen: (open) => set({ isMenuOpen: open }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
}));
