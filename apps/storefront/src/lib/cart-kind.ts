// Mirrors apps/backend/src/lib/kosmotech-dropship.ts (classifyCart/allowedProviders).
// Duplicated deliberately — frontend and backend are separate deployables, same
// pattern as np-tracking-url.ts being duplicated for the admin bundle (see
// docs/NOVAPOSHTA.md). The backend's version is the one actually enforced
// (middlewares.ts); this copy only drives storefront UI (which payment/shipping
// options to show) and must never be treated as the source of truth.

export type CartKind = "own" | "dropship" | "mixed" | "empty";

export function isKosmotechProduct(metadata: Record<string, unknown> | null | undefined): boolean {
  return !!metadata && "kosmotech" in metadata;
}

export function classifyCartItems(
  items: Array<{ variant?: { product?: { metadata?: Record<string, unknown> | null } | null } | null }>
): CartKind {
  if (!items.length) return "empty";
  const hasDropship = items.some((i) => isKosmotechProduct(i.variant?.product?.metadata));
  const hasOwn = items.some((i) => !isKosmotechProduct(i.variant?.product?.metadata));
  if (hasDropship && hasOwn) return "mixed";
  return hasDropship ? "dropship" : "own";
}

export const MONO_PROVIDER_ID = "pp_monobank_monobank";
export const COD_PROVIDER_ID = "pp_cod_cod";

// NOVA collects the money for Kosmotech dropship orders too (card or NP
// postplata to NOVA's account; Kosmotech is invoiced separately via B2B) —
// so "own" and "dropship" carts allow the same providers. Only mixed carts
// are invalid. See docs/DROPSHIP-KOSMOTECH.md §0.
export function allowedProviderIds(kind: CartKind): string[] {
  switch (kind) {
    case "own":
    case "dropship":
      return [MONO_PROVIDER_ID, "pp_system_system", COD_PROVIDER_ID];
    case "mixed":
    case "empty":
      return [];
  }
}

/** The exact shipping-option name for Kosmotech dropship orders — see
 *  docs/DROPSHIP-KOSMOTECH.md §4. Must match what's created in the admin
 *  (or seed.ts locally) exactly. The option is a REAL Nova Poshta warehouse
 *  option (data.id "novaposhta-warehouse") on the dedicated Kosmotech
 *  shipping profile; the name is how the storefront tells it apart from the
 *  own-goods NP options. */
export const DROPSHIP_SHIPPING_OPTION_NAME = "Нова Пошта (відправлення постачальника)";
