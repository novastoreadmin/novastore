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

/** Any supplier-sourced product: metadata.kosmotech today, or
 *  metadata.dropship = { supplier } for wholesalers added later. */
export function isDropshipMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  return !!metadata && ("kosmotech" in metadata || "dropship" in metadata);
}

type ClassifyItem = {
  variant?: { product?: { metadata?: Record<string, unknown> | null } | null } | null;
};

export function classifyCartItems(items: ClassifyItem[]): CartKind {
  if (!items.length) return "empty";
  const hasDropship = items.some((i) => isDropshipMetadata(i.variant?.product?.metadata));
  const hasOwn = items.some((i) => !isDropshipMetadata(i.variant?.product?.metadata));
  if (hasDropship && hasOwn) return "mixed";
  return hasDropship ? "dropship" : "own";
}

/** Splits a mixed cart's items into the two future orders — drives the
 *  two-shipment checkout summary. Backend mirror: partitionCartItems(). */
export function partitionCartItems<T extends ClassifyItem>(items: T[]): { own: T[]; dropship: T[] } {
  const own: T[] = [];
  const dropship: T[] = [];
  for (const item of items) {
    (isDropshipMetadata(item.variant?.product?.metadata) ? dropship : own).push(item);
  }
  return { own, dropship };
}

export const MONO_PROVIDER_ID = "pp_monobank_monobank";
export const COD_PROVIDER_ID = "pp_cod_cod";

// Owner's rules (2026-09): suppliers work ONLY by cash-on-delivery and ship
// the parcels themselves against NOVA's waybill number, so dropship carts pay
// by NP postplata only. Own goods take prepayment (Monobank) or postplata.
// Mixed carts can't be paid in one transaction — checkout splits them into
// two orders (POST /store/carts/:id/split-dropship) before completion.
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

/** The exact shipping-option name for Kosmotech dropship orders — see
 *  docs/DROPSHIP-KOSMOTECH.md §4. Must match what's created in the admin
 *  (or seed.ts locally) exactly. The option is a REAL Nova Poshta warehouse
 *  option (data.id "novaposhta-warehouse") on the dedicated Kosmotech
 *  shipping profile; the name is how the storefront tells it apart from the
 *  own-goods NP options. */
export const DROPSHIP_SHIPPING_OPTION_NAME = "Нова Пошта (відправлення постачальника)";
