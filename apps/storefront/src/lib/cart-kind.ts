// Mirrors apps/backend/src/lib/itsellopt-dropship.ts (classifyCart/allowedProviders).
// Duplicated deliberately — frontend and backend are separate deployables, same
// pattern as np-tracking-url.ts being duplicated for the admin bundle (see
// docs/NOVAPOSHTA.md). The backend's version is the one actually enforced
// (middlewares.ts); this copy only drives storefront UI (which payment/shipping
// options to show) and must never be treated as the source of truth.

export type CartKind = "own" | "dropship" | "mixed" | "empty";

export function isItselloptProduct(metadata: Record<string, unknown> | null | undefined): boolean {
  return !!metadata && "itsellopt" in metadata;
}

export function classifyCartItems(
  items: Array<{ variant?: { product?: { metadata?: Record<string, unknown> | null } | null } | null }>
): CartKind {
  if (!items.length) return "empty";
  const hasDropship = items.some((i) => isItselloptProduct(i.variant?.product?.metadata));
  const hasOwn = items.some((i) => !isItselloptProduct(i.variant?.product?.metadata));
  if (hasDropship && hasOwn) return "mixed";
  return hasDropship ? "dropship" : "own";
}

export const MONO_PROVIDER_ID = "pp_monobank_monobank";
export const COD_PROVIDER_ID = "pp_cod_cod";

export function allowedProviderIds(kind: CartKind): string[] {
  switch (kind) {
    case "own":
      return [MONO_PROVIDER_ID, "pp_system_system", COD_PROVIDER_ID];
    case "dropship":
      return [COD_PROVIDER_ID];
    case "mixed":
    case "empty":
      return [];
  }
}

/** The exact shipping-option name for ITsellOPT dropship orders — see
 *  docs/DROPSHIP-ITSELLOPT.md §4. Must match what's created in the admin
 *  (or seed.ts locally) exactly; there is no other reliable signal since the
 *  option's `data.id` is shared with every other shipping option on the
 *  `manual` provider ("manual-fulfillment"). */
export const DROPSHIP_SHIPPING_OPTION_NAME = "Нова Пошта (відправлення постачальника)";
