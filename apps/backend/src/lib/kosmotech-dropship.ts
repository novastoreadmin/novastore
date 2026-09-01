// Pure helpers for the Kosmotech dropship flow (docs/DROPSHIP-KOSMOTECH.md).
// No Medusa imports, same pattern as order-email.ts / runtime-config.ts, so
// this is unit-testable without spinning up the framework.
//
// The dropship marker is `product.metadata.kosmotech` - present ONLY on
// Kosmotech-sourced products, never on NOVA's own catalog.
//
// Money model: NOVA collects the customer's money itself (Monobank card or
// NP cash-on-delivery to NOVA's account) and creates the waybill from its
// own NP business account; Kosmotech
// ships the parcel against that waybill number ("Відправка по ТТН" in their
// B2B cabinet) and invoices NOVA the wholesale price separately. So a
// Kosmotech cart pays with the SAME providers as an own cart - the only hard
// rule left is no mixed carts (two warehouses = two parcels = two waybills).

export type CartClassifyItem = {
  product?: { metadata?: Record<string, unknown> | null } | null
}

export type CartKind = "own" | "dropship" | "mixed" | "empty"

export function isKosmotechProduct(item: CartClassifyItem): boolean {
  return !!item.product?.metadata && "kosmotech" in item.product.metadata
}

/**
 * Classifies a cart/order by what it contains. "mixed" carts are invalid in
 * v1 (own goods ship from NOVA's warehouse, Kosmotech goods from the
 * supplier's - different parcels, different waybills) and must be rejected
 * before checkout, not silently accepted.
 */
export function classifyCart(items: CartClassifyItem[] | null | undefined): CartKind {
  const list = items ?? []
  if (!list.length) return "empty"
  const hasDropship = list.some(isKosmotechProduct)
  const hasOwn = list.some((i) => !isKosmotechProduct(i))
  if (hasDropship && hasOwn) return "mixed"
  return hasDropship ? "dropship" : "own"
}

/**
 * Payment provider ids (Medusa's `pp_<id>_<id>` convention) a cart of this
 * kind may pay with. NOVA collects the money for dropship orders too (see
 * the money-model note above), so "own" and "dropship" allow the same set.
 * "mixed"/"empty" allow nothing - the caller must reject the request rather
 * than let checkout proceed.
 */
export function allowedProviders(kind: CartKind): string[] {
  switch (kind) {
    case "own":
    case "dropship":
      return ["pp_monobank_monobank", "pp_system_system", "pp_cod_cod"]
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
