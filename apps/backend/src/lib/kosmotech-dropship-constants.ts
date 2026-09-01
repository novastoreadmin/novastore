// Single source of truth for the exact shipping-option name that identifies
// the Kosmotech dropship option (see docs/DROPSHIP-KOSMOTECH.md §4). Used by
// seed.ts (creates it), middlewares.ts (validates it), and mirrored in
// apps/storefront/src/lib/cart-kind.ts (frontend can't import backend code).
// Customer-facing, deliberately partner-neutral wording.
export const DROPSHIP_SHIPPING_OPTION_NAME = "Нова Пошта (відправлення постачальника)"
