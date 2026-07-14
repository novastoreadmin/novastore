// Single source of truth for the exact shipping-option name that identifies
// the ITsellOPT dropship option (see docs/DROPSHIP-ITSELLOPT.md §4). Used by
// seed.ts (creates it), middlewares.ts (validates it), and mirrored in
// apps/storefront/src/lib/cart-kind.ts (frontend can't import backend code).
export const DROPSHIP_SHIPPING_OPTION_NAME = "Нова Пошта (відправлення постачальника)"
