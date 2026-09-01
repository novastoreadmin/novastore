// Pure helpers for the Kosmotech dropship flow (docs/DROPSHIP-KOSMOTECH.md).
// No Medusa imports, same pattern as order-email.ts / runtime-config.ts, so
// this is unit-testable without spinning up the framework.
//
// The dropship marker is `product.metadata.kosmotech` (Kosmotech) or, for
// future wholesalers, `product.metadata.dropship = { supplier: "<id>" }` -
// present ONLY on supplier-sourced products, never on NOVA's own catalog.
//
// Money model (owner's rules, 2026-09): suppliers work ONLY by cash-on-
// delivery and ship the parcels themselves against a waybill number NOVA
// creates ("Відправка по ТТН" in the Kosmotech B2B cabinet) - so dropship
// carts pay by NP postplata only. NOVA's own goods are prepaid to NOVA's
// account (Monobank card) or NP postplata, and NOVA ships them itself.
// A mixed cart can't be paid in one transaction (different provider sets),
// so checkout SPLITS it into two orders - see partitionCartItems() and
// POST /store/carts/:id/split-dropship. A mixed cart itself must still
// never COMPLETE directly.

export type CartClassifyItem = {
  product?: { metadata?: Record<string, unknown> | null } | null
}

export type CartKind = "own" | "dropship" | "mixed" | "empty"

export function isKosmotechProduct(item: CartClassifyItem): boolean {
  return !!item.product?.metadata && "kosmotech" in item.product.metadata
}

/** Any supplier-sourced product: Kosmotech today, `metadata.dropship.supplier`
 *  for wholesalers added later - the checkout rules are identical for all. */
export function isDropshipProduct(item: CartClassifyItem): boolean {
  const md = item.product?.metadata
  return !!md && ("kosmotech" in md || "dropship" in md)
}

/** Which supplier a product ships from, or null for NOVA's own goods. */
export function supplierOf(item: CartClassifyItem): string | null {
  const md = item.product?.metadata
  if (!md) return null
  if ("kosmotech" in md) return "kosmotech"
  const dropship = md.dropship as { supplier?: string } | undefined
  return typeof dropship?.supplier === "string" ? dropship.supplier : null
}

/**
 * Classifies a cart/order by what it contains. "mixed" carts can't complete
 * as-is (own goods ship prepaid from NOVA's warehouse, supplier goods ship
 * COD from the supplier's - different parcels, waybills AND payment rules);
 * checkout splits them into two orders before completion.
 */
export function classifyCart(items: CartClassifyItem[] | null | undefined): CartKind {
  const list = items ?? []
  if (!list.length) return "empty"
  const hasDropship = list.some(isDropshipProduct)
  const hasOwn = list.some((i) => !isDropshipProduct(i))
  if (hasDropship && hasOwn) return "mixed"
  return hasDropship ? "dropship" : "own"
}

/**
 * Splits a mixed cart's items into the two future orders. Used by the
 * split-dropship route (and mirrored on the storefront for the two-shipment
 * summary UI).
 */
export function partitionCartItems<T extends CartClassifyItem>(
  items: T[] | null | undefined
): { own: T[]; dropship: T[] } {
  const own: T[] = []
  const dropship: T[] = []
  for (const item of items ?? []) {
    ;(isDropshipProduct(item) ? dropship : own).push(item)
  }
  return { own, dropship }
}

/**
 * Payment provider ids (Medusa's `pp_<id>_<id>` convention) a cart of this
 * kind may pay with. Suppliers work only by cash-on-delivery (see the
 * money-model note above), so dropship carts allow cod ONLY; own carts take
 * prepayment (Monobank) or cod. "mixed"/"empty" allow nothing - a mixed cart
 * must be split into two orders before any payment session is created.
 */
export function allowedProviders(kind: CartKind): string[] {
  switch (kind) {
    case "own":
      return ["pp_monobank_monobank", "pp_system_system", "pp_cod_cod"]
    case "dropship":
      return ["pp_cod_cod"]
    case "mixed":
    case "empty":
      return []
  }
}

export type DropshipOrderItem = {
  quantity: number
  variant?: {
    sku?: string | null
    product?: { title?: string | null } | null
  } | null
}

export type DropshipOrderInput = {
  display_id?: number | string | null
  email?: string | null
  total?: number | null
  currency_code?: string | null
  items?: DropshipOrderItem[] | null
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
  } | null
  /** Shipping method `data` - the Kosmotech dropship option is a regular
   *  Nova Poshta warehouse option (np_kind/np_city_name/... keys), because
   *  NOVA creates the waybill itself - see docs/DROPSHIP-KOSMOTECH.md §4. */
  shipping_methods?: { data?: Record<string, unknown> | null }[] | null
}

const NOT_SET = "?"

export type KosmotechImportRow = { article: string; count: number }

/**
 * Rows for the Kosmotech B2B cabinet's "Імпорт замовлення з Excel" bulk
 * cart-add (https://newb2b.kosmotech.com.ua/ua/checkout/): a two-column
 * sheet, header `article` + `count`, one row per SKU. Variant SKUs in the
 * NOVA catalog ARE Kosmotech articles for dropship products (checked when
 * importing the supplier's product file).
 */
export function buildKosmotechImportRows(order: DropshipOrderInput): KosmotechImportRow[] {
  return (order.items ?? [])
    .filter((i): i is DropshipOrderItem & { variant: { sku: string } } => !!i.variant?.sku)
    .map((i) => ({ article: i.variant.sku, count: i.quantity }))
}

/**
 * Builds the ops-facing summary for one dropship order: the article/quantity
 * lines to reproduce in the Kosmotech cabinet, the waybill number Kosmotech
 * ships against, and the customer/delivery details for cross-checking (the
 * cabinet auto-fills recipient data from the waybill number - we never send
 * customer PII to Kosmotech ourselves).
 */
export function buildDropshipOrderText(order: DropshipOrderInput, ttn?: string | null): string {
  const importLines = buildKosmotechImportRows(order)
    .map((r) => `${r.article} ${r.count}`)
    .join("\n")

  const npData = order.shipping_methods?.find(
    (m) => m.data && "np_kind" in (m.data ?? {})
  )?.data as Record<string, unknown> | undefined

  const customerName = [order.shipping_address?.first_name, order.shipping_address?.last_name]
    .filter(Boolean)
    .join(" ")
  const phone = order.shipping_address?.phone || NOT_SET
  const city = (npData?.np_city_name as string) || NOT_SET
  const warehouse = (npData?.np_warehouse_description as string) || NOT_SET
  // order.total arrives as a BigNumber-like object from query.graph (its
  // default toString gives an ugly zero-padded decimal, e.g.
  // "358.00000000000000000") - Number() coerces it to a clean value. This
  // store keeps whole hryvnias (see toStoreMinor in data/catalog.ts), so no
  // /100 division here, same as order-email.ts.
  const total = Number(order.total ?? 0)
  const currency = (order.currency_code ?? "uah").toUpperCase()

  return [
    `Замовлення NOVA #${order.display_id ?? NOT_SET}`,
    "",
    "Товари (article count — Кошик → Імпорт замовлення з Excel у кабінеті Kosmotech):",
    importLines || "(немає позицій з SKU — перевір вручну)",
    "",
    `ТТН Нової Пошти (спосіб доставки в кабінеті — «Відправка по ТТН»): ${ttn || "ще не створена"}`,
    "",
    `Клієнт: ${customerName || NOT_SET}`,
    `Телефон: ${phone}`,
    `Місто: ${city}`,
    `Відділення: ${warehouse}`,
    `Сума замовлення: ${total} ${currency}`,
  ].join("\n")
}
