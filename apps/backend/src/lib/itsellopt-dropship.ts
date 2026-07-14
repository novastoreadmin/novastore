// Pure helpers for the ITsellOPT dropship flow (docs/DROPSHIP-ITSELLOPT.md).
// No Medusa imports, same pattern as order-email.ts / runtime-config.ts, so
// this is unit-testable without spinning up the framework.
//
// The dropship marker is `product.metadata.itsellopt` (see
// src/data/catalog-itsellopt.ts) - present ONLY on ITsellOPT-sourced products,
// never on NOVA's own catalog.

export type CartClassifyItem = {
  product?: { metadata?: Record<string, unknown> | null } | null
}

export type CartKind = "own" | "dropship" | "mixed" | "empty"

export function isItselloptProduct(item: CartClassifyItem): boolean {
  return !!item.product?.metadata && "itsellopt" in item.product.metadata
}

/**
 * Classifies a cart/order by what it contains. "mixed" carts are invalid in
 * v1 (own goods and ITsellOPT dropship goods ship on different waybills to
 * different money recipients - see docs/DROPSHIP-ITSELLOPT.md §0) and must be
 * rejected before checkout, not silently accepted.
 */
export function classifyCart(items: CartClassifyItem[] | null | undefined): CartKind {
  const list = items ?? []
  if (!list.length) return "empty"
  const hasDropship = list.some(isItselloptProduct)
  const hasOwn = list.some((i) => !isItselloptProduct(i))
  if (hasDropship && hasOwn) return "mixed"
  return hasDropship ? "dropship" : "own"
}

/**
 * Payment provider ids (Medusa's `pp_<id>_<id>` convention) a cart of this
 * kind may pay with. "mixed"/"empty" allow nothing - the caller must reject
 * the request rather than let checkout proceed.
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
  /** Shipping method `data` - the dropship NP option stores dropship_np_* keys
   *  (deliberately NOT np_kind, so order-placed-novaposhta.ts's auto-TTN guard
   *  skips it - see docs/DROPSHIP-ITSELLOPT.md §4). */
  shipping_methods?: { data?: Record<string, unknown> | null }[] | null
}

const NOT_SET = "?"

/**
 * Builds the copy-paste block for ITsellOPT's own "Кошик → Імпорт товарів у
 * кошик" bulk-add (format: "<offer id> <qty>" per line, one item per SKU -
 * see itsellopt-feed.ts's buildCartImportText, which this mirrors) plus the
 * customer/delivery details the ops person types into their checkout when
 * placing the matching dropship order.
 */
export function buildDropshipOrderText(order: DropshipOrderInput): string {
  const items = (order.items ?? []).filter(
    (i): i is DropshipOrderItem & { variant: { sku: string } } => !!i.variant?.sku
  )
  const cartImportLines = items.map((i) => `${i.variant.sku} ${i.quantity}`).join("\n")

  const npData = order.shipping_methods?.find(
    (m) => m.data && "dropship_np_city_name" in (m.data ?? {})
  )?.data as Record<string, unknown> | undefined

  const customerName = [order.shipping_address?.first_name, order.shipping_address?.last_name]
    .filter(Boolean)
    .join(" ")
  const phone = order.shipping_address?.phone || NOT_SET
  const city = (npData?.dropship_np_city_name as string) || NOT_SET
  const warehouse = (npData?.dropship_np_warehouse_description as string) || NOT_SET
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
    "Товари (код кількість — вставити в ITsellOPT: Кошик → Імпорт товарів у кошик):",
    cartImportLines || "(немає позицій з SKU — перевір вручну)",
    "",
    `Клієнт: ${customerName || NOT_SET}`,
    `Телефон: ${phone}`,
    `Місто: ${city}`,
    `Відділення: ${warehouse}`,
    `Сума післяплати: ${total} ${currency}`,
  ].join("\n")
}
