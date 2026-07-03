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

// Logged-in customer state. The JWT itself lives in localStorage (managed by
// the Medusa SDK); this store only mirrors "who is logged in" for the UI.
// `status` starts as "loading" so guarded pages don't flash a redirect while
// the initial /store/customers/me check is in flight.
export interface AuthCustomer {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}

interface AuthState {
  customer: AuthCustomer | null;
  status: "loading" | "authenticated" | "guest";
  setCustomer: (customer: AuthCustomer | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  customer: null,
  status: "loading",
  setCustomer: (customer) =>
    set({ customer, status: customer ? "authenticated" : "guest" }),
}));

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
